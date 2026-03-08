import os
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

class KnowledgeRequest(BaseModel):
    text: Optional[str] = None
    url: Optional[str] = None
    profile: str = "default"

class PairUpdateRequest(BaseModel):
    status: Optional[str] = None
    edited_output: Optional[str] = None

class RunTrainingRequest(BaseModel):
    profile: str = "default"
    iters: int = 100

def create_training_router(get_server):
    router = APIRouter(prefix="/training", tags=["training"])

    @router.post("/add-knowledge")
    async def add_knowledge(request: KnowledgeRequest):
        server = get_server()
        try:
            if request.url:
                await server.training_service.add_knowledge_from_url(request.url, profile=request.profile)
            elif request.text:
                await server.training_service.add_knowledge_from_text(request.text, profile=request.profile)
            else:
                raise HTTPException(status_code=400, detail="Either text or url must be provided.")
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/pairs")
    async def get_pairs(profile: str = "default"):
        server = get_server()
        return await server.training_service.get_pairs(profile=profile)

    @router.get("/stats")
    async def get_stats(profile: str = "default"):
        server = get_server()
        return await server.training_service.get_stats(profile=profile)

    @router.get("/profiles")
    async def get_profiles():
        server = get_server()
        return await server.training_service.get_profiles()

    @router.post("/rename-profile")
    async def rename_profile(old_name: str, new_name: str):
        server = get_server()
        await server.training_service.rename_profile(old_name, new_name)
        return {"status": "success"}

    @router.post("/profiles/init")
    async def init_profile(profile: str):
        server = get_server()
        await server.training_service.init_profile(profile)
        return {"status": "success"}

    @router.delete("/profiles/{profile}")
    async def delete_profile(profile: str):
        await server.training_service.delete_profile(profile)
        return {"status": "success"}

    @router.get("/adapter-path")
    async def get_adapter_path(profile: str):
        server = get_server()
        path = os.path.join(server.config.app_data_dir, "adapters", "llm", profile)
        return {"adapter_path": path}

    @router.post("/pairs/{pair_id}")
    async def update_pair(pair_id: int, request: PairUpdateRequest):
        server = get_server()
        await server.training_service.update_pair(pair_id, status=request.status, edited_output=request.edited_output)
        return {"status": "success"}

    @router.delete("/pairs/{pair_id}")
    async def delete_pair(pair_id: int):
        server = get_server()
        await server.training_service.delete_pair(pair_id)
        return {"status": "success"}

    @router.post("/run")
    async def run_training(request: RunTrainingRequest):
        server = get_server()
        try:
            local_cfg = server.config.get("llm", {}).get("providers", {}).get("local", {})
            model_path = local_cfg.get("model")
            if not model_path:
                raise HTTPException(status_code=400, detail="Local LLM model path is not configured.")
            
            # Use profile for adapter path
            adapter_path = os.path.join(server.config.app_data_dir, "adapters", "llm", request.profile)
            os.makedirs(os.path.dirname(adapter_path), exist_ok=True)

            process, count = await server.training_service.run_training(
                model_path=model_path,
                adapter_path=adapter_path,
                iters=request.iters,
                profile=request.profile
            )
            
            # Start background monitoring
            asyncio.create_task(server.training_service.monitor_training(request.profile, process))
            
            return {
                "status": "success", 
                "message": f"プロファイル「{request.profile}」の特訓を開始したよ！ちょっと時間かかるから待っててね。",
                "adapter_path": adapter_path
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/status")
    async def get_training_status(profile: str = "default"):
        server = get_server()
        return server.training_service.get_training_status(profile)

    return router
