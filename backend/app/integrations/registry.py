from typing import Type
from .base import IntegrationAdapter

_registry = {}

def register_adapter(system_type: str):
    def wrapper(cls: Type[IntegrationAdapter]):
        _registry[system_type] = cls
        return cls
    return wrapper

SYSTEM_TYPE_ALIASES = {
    "ERP": "ERPNext",
    "ERPNEXT": "ERPNext",
    "Custom API": "Generic REST",
    "CUSTOM API": "Generic REST",
    "WMS": "Generic REST",
    "CRM": "Generic REST",
    "SAP S/4HANA Cloud": "Generic REST",
    "Oracle NetSuite ERP": "Generic REST",
}

def get_adapter(system_type: str) -> Type[IntegrationAdapter]:
    normalized = SYSTEM_TYPE_ALIASES.get(system_type, system_type)
    adapter_cls = _registry.get(normalized)
    if not adapter_cls:
        # Case-insensitive lookup fallback
        for key, cls in _registry.items():
            if key.lower() == normalized.lower():
                return cls
        # Default fallback to Generic REST if available
        if "Generic REST" in _registry:
            return _registry["Generic REST"]
        raise ValueError(f"No adapter registered for system_type: {system_type}")
    return adapter_cls
