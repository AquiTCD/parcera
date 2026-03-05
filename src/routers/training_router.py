import logging
from fastapi import APIRouter, UploadFile, File, Form
from src.services.training_service import TrainingService

logger = logging.getLogger(__name__)

def create_training_router(get_server_callback):
    router = APIRouter(prefix="/training", tags=["Training"])
    # Note: In a real app, you might want to share this service instance
    training_service = TrainingService()

    @router.post("/record")
    async def record_training_data(phrase: str = Form(...), audio: UploadFile = File(...)):
        """
        Receive recorded audio and phrase for STT training.
        """
        try:
            logger.info(f"Received training record for phrase: {phrase}")
            audio_data = await audio.read()
            
            # Save and process
            file_path = training_service.save_audio(audio_data, phrase)
            training_service.update_dataset(file_path, phrase)
            
            # Basic validation
            validation = training_service.validate_audio(file_path)
            
            logger.info(f"Training record saved to {file_path}. Validation: {validation}")
            
            return {
                "success": True, 
                "path": file_path,
                "validation": validation
            }
        except Exception as e:
            logger.error(f"Failed to save training record: {e}", exc_info=True)
            return {"success": False, "error": str(e)}

    return router
