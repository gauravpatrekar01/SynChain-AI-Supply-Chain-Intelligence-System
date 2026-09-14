from typing import Type
from .base import IntegrationAdapter

_registry = {}

def register_adapter(system_type: str):
    def wrapper(cls: Type[IntegrationAdapter]):
        _registry[system_type] = cls
        return cls
    return wrapper

def get_adapter(system_type: str) -> Type[IntegrationAdapter]:
    adapter_cls = _registry.get(system_type)
    if not adapter_cls:
        raise ValueError(f"No adapter registered for system_type: {system_type}")
    return adapter_cls
