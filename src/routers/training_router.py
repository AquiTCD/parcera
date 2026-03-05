import logging
from fastapi import APIRouter, UploadFile, File, Form
from services.training_service import TrainingService

logger = logging.getLogger(__name__)

def create_training_router(get_server_callback):
    router = APIRouter(prefix="/training", tags=["Training"])
    # Note: In a real app, you might want to share this service instance
    training_service = TrainingService()

    @router.post("/record")
    async def record_training_data(
        phrase: str = Form(...), 
        audio: UploadFile = File(...),
        profile_id: str = Form("default")
    ):
        """
        Receive recorded audio and phrase for STT training.
        """
        try:
            logger.info(f"Received training record for phrase: {phrase}")
            audio_data = await audio.read()
            
            # Save and process
            service = TrainingService(profile_id=profile_id)
            file_path = service.save_audio(audio_data, phrase, filename_hint=audio.filename)
            service.update_dataset(file_path, phrase)
            
            # Basic validation
            validation = service.validate_audio(file_path)
            
            logger.info(f"Training record saved to {file_path}. Validation: {validation}")
            
            return {
                "success": True, 
                "path": file_path,
                "validation": validation
            }
        except Exception as e:
            logger.error(f"Failed to save training record: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    @router.post("/mode")
    async def toggle_training_mode(enabled: bool):
        """
        Toggle silent training mode.
        When enabled, the STT wrapper ignores input to prevent the AI from responding.
        """
        server = get_server_callback()
        if server:
            server.silent_training = enabled
            logger.info(f"Silent training mode set to: {enabled}")
            return {"success": True, "silent_training": enabled}
        return {"success": False, "error": "Server not available"}

    @router.get("/profiles")
    async def list_profiles():
        return {"profiles": TrainingService().list_profiles()}

    @router.get("/profiles/{profile_id}/progress")
    async def get_training_progress(profile_id: str):
        service = TrainingService(profile_id=profile_id)
        progress = service.get_progress()
        logger.info(f"API: Progress request for {profile_id} -> {progress}")
        return {"progress": progress}

    @router.get("/profiles/{profile_id}/status")
    async def get_training_status(profile_id: str):
        service = TrainingService(profile_id=profile_id)
        return service.get_training_status()

    @router.post("/profiles/{profile_id}/train")
    async def start_training(profile_id: str, epochs: int = 10):
        service = TrainingService(profile_id=profile_id)
        return service.start_training(epochs=epochs)

    @router.post("/profiles/{profile_id}/apply")
    async def apply_training(profile_id: str):
        # This triggers a reload of the STT component on the server
        # which will pick up the new adapters.npz file
        server = get_server_callback()
        try:
            server.reload_stt()
            return {"success": True, "message": "STT reloaded with new training data"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @router.get("/profiles/{profile_id}")
    async def get_profile(profile_id: str):
        service = TrainingService(profile_id=profile_id)
        return {
            "profile_id": profile_id,
            "metadata": service.get_metadata()
        }

    @router.post("/profiles")
    async def create_profile(profile_id: str, name: str, description: str = ""):
        service = TrainingService(profile_id=profile_id)
        metadata = service.initialize_profile(name, description)
        return {"success": True, "metadata": metadata}

    @router.patch("/profiles/{profile_id}")
    async def update_profile(profile_id: str, name: str = None, description: str = None):
        service = TrainingService(profile_id=profile_id)
        updates = {}
        if name is not None: updates["name"] = name
        if description is not None: updates["description"] = description
        metadata = service.update_metadata(**updates)
        return {"success": True, "metadata": metadata}

    @router.delete("/profiles/{profile_id}")
    async def delete_profile(profile_id: str):
        service = TrainingService(profile_id=profile_id)
        success = service.delete_profile()
        return {"success": success}

    @router.post("/profiles/{profile_id}/reset")
    async def reset_training_status(profile_id: str):
        service = TrainingService(profile_id=profile_id)
        service.reset_training()
        
        # Also trigger a reload so the running STT unloads the deleted adapter
        server = get_server_callback()
        if server and hasattr(server, "stt"):
            server.stt.reload()
            
        return {"success": True}

    return router
