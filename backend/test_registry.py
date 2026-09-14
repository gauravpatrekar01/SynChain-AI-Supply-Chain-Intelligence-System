import sys
sys.path.append('d:/SynChain-AI-Supply-Chain-Intelligence-System/backend')
from app.integrations import get_adapter
try:
    print(get_adapter("ERPNext"))
except Exception as e:
    print("Error:", e)
