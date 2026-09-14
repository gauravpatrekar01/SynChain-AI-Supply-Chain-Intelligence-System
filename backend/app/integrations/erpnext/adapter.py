import httpx
from typing import Dict, Any, List
from ..base import IntegrationAdapter
from ..registry import register_adapter

@register_adapter("ERPNext")
class ERPNextAdapter(IntegrationAdapter):
    def _get_headers(self):
        return {
            "Authorization": f"token {self.api_key}:{self.api_secret}",
            "Accept": "application/json"
        }

    async def test_connection(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
                response = await client.get(f"{self.base_url}/api/resource/User", headers=self._get_headers())
            return response.is_success
        except (httpx.HTTPError, ValueError):
            return False

    async def _fetch_resource(self, resource_name: str) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
                response = await client.get(f"{self.base_url}/api/resource/{resource_name}?limit_page_length=1000", headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                return data.get("data", [])
        except httpx.HTTPError:
            return []

    async def get_items(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("Item")

    async def get_suppliers(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("Supplier")

    async def get_warehouses(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("Warehouse")

    async def get_inventory(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("Bin") # Bin holds stock details in ERPNext

    async def get_purchase_orders(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("Purchase Order")

    async def get_sales_orders(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("Sales Order")
