from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    musescore_path: str = 'musescore'
    musescore_wrapper: str = ''
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    
settings = Settings()