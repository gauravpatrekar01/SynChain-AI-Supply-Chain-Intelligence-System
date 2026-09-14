import httpx
from typing import Dict, Any, List
from ..base import IntegrationAdapter
from ..registry import register_adapter
import base64

@register_adapter("Generic REST")
class GenericRESTAdapter(IntegrationAdapter):
    def _get_headers(self):
        headers = {"Accept": "application/json"}
        if self.auth_type == "api_key":
            headers["X-API-Key"] = self.api_key
        elif self.auth_type == "bearer":
            headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.auth_type == "basic":
            credentials = f"{self.api_key}:{self.api_secret}"
            encoded_creds = base64.b64encode(credentials.encode()).decode()
            headers["Authorization"] = f"Basic {encoded_creds}"
        return headers

    async def test_connection(self) -> bool:
        test_endpoint = self.configuration.get("endpoints", {}).get("test", "")
        url = f"{self.base_url}{test_endpoint}" if test_endpoint else self.base_url
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=False) as client:
                response = await client.get(url, headers=self._get_headers())
            return response.is_success
        except (httpx.HTTPError, ValueError):
            return False

    async def _fetch_resource(self, resource_key: str) -> List[Dict[str, Any]]:
        endpoint = self.configuration.get("endpoints", {}).get(resource_key)
        if not endpoint:
            return []
            
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
                response = await client.get(f"{self.base_url}{endpoint}", headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                
                # Assume if data is list, return it. If dict, try to find a list value (e.g. "data" or "items")
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    for key in ["data", "items", "results"]:
                        if key in data and isinstance(data[key], list):
                            return data[key]
                    return [data] # Fallback
                return []
        except httpx.HTTPError:
            return []

    async def get_items(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("items")

    async def get_suppliers(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("suppliers")

    async def get_warehouses(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("warehouses")

    async def get_inventory(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("inventory")

    async def get_purchase_orders(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("purchase_orders")

    async def get_sales_orders(self) -> List[Dict[str, Any]]:
        return await self._fetch_resource("sales_orders")
