# Integrations Module
from .registry import register_adapter, get_adapter
from .base import IntegrationAdapter

# Import adapters to register them
from .erpnext import adapter
from .generic_rest import adapter

