import httpx
from abc import ABC, abstractmethod
from typing import Dict, Any, List

class IntegrationAdapter(ABC):
    """
    Abstract base class for all ERP/WMS/API integration adapters.
    """
    def __init__(self, base_url: str, auth_type: str, api_key: str = None, api_secret: str = None, configuration: Dict[str, Any] = None):
        self.base_url = base_url.rstrip("/")
        self.auth_type = auth_type
        self.api_key = api_key
        self.api_secret = api_secret
        self.configuration = configuration or {}

    @abstractmethod
    async def test_connection(self) -> bool:
        pass

    @abstractmethod
    async def get_items(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_suppliers(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_warehouses(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_inventory(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_purchase_orders(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def get_sales_orders(self) -> List[Dict[str, Any]]:
        pass
