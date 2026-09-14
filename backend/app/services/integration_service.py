from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.postgres.models import EnterpriseIntegration
from app.integrations import get_adapter
from app.core.security import decrypt_secret
from .normalization_service import NormalizationService
from datetime import datetime, timezone

class IntegrationService:
    @staticmethod
    def get_adapter_instance(integration: EnterpriseIntegration):
        adapter_cls = get_adapter(integration.system_type)
        api_key = decrypt_secret(integration.encrypted_api_key) if integration.encrypted_api_key else None
        api_secret = decrypt_secret(integration.encrypted_api_secret) if integration.encrypted_api_secret else None
        
        return adapter_cls(
            base_url=integration.base_url,
            auth_type=integration.auth_type,
            api_key=api_key,
            api_secret=api_secret,
            configuration=integration.configuration
        )

    @staticmethod
    async def sync_integration(db: Session, integration: EnterpriseIntegration) -> Dict[str, Any]:
        adapter = IntegrationService.get_adapter_instance(integration)
        
        # Test connection first
        is_connected = await adapter.test_connection()
        if not is_connected:
            integration.status = "error"
            db.commit()
            raise Exception(f"Failed to connect to integration: {integration.name}")

        field_map = integration.configuration.get("field_mapping", {}) if integration.configuration else {}

        # Fetch and normalize data
        raw_items = await adapter.get_items()
        items_count = NormalizationService.normalize_items(db, raw_items, field_map.get("items"))

        raw_suppliers = await adapter.get_suppliers()
        suppliers_count = NormalizationService.normalize_suppliers(db, raw_suppliers, field_map.get("suppliers"))

        raw_warehouses = await adapter.get_warehouses()
        warehouses_count = NormalizationService.normalize_warehouses(db, raw_warehouses, field_map.get("warehouses"))

        raw_inventory = await adapter.get_inventory()
        inventory_count = NormalizationService.normalize_inventory(db, raw_inventory, field_map.get("inventory"))

        integration.status = "connected"
        integration.last_tested_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "items": items_count,
            "suppliers": suppliers_count,
            "warehouses": warehouses_count,
            "inventory": inventory_count
        }
