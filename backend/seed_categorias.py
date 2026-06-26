"""
Seed das categorias padrão do NexusVarejo.
Roda este script para criar/atualizar as 13 categorias.
"""
import sys
sys.path.insert(0, r"C:\Users\marci\OneDrive\Área de Trabalho\Sistema Vendas NexusVarejo\backend")
from database import SessionLocal
from models import CategoriaProduto

CATEGORIAS = [
    {"nome": "01 - Mercearia",            "icone": "🛒", "cor": "#f97316", "margem_padrao": 25.0},
    {"nome": "02 - Cereais e Commodities","icone": "🌾", "cor": "#eab308", "margem_padrao": 20.0},
    {"nome": "03 - FLV",                  "icone": "🥦", "cor": "#22c55e", "margem_padrao": 40.0},
    {"nome": "04 - Açougue",              "icone": "🥩", "cor": "#ef4444", "margem_padrao": 35.0},
    {"nome": "05 - Padaria",              "icone": "🍞", "cor": "#f59e0b", "margem_padrao": 50.0},
    {"nome": "06 - Frios e Laticínios",   "icone": "🧀", "cor": "#3b82f6", "margem_padrao": 30.0},
    {"nome": "07 - Congelados",           "icone": "🧊", "cor": "#06b6d4", "margem_padrao": 30.0},
    {"nome": "08 - Bebidas",              "icone": "🧃", "cor": "#8b5cf6", "margem_padrao": 35.0},
    {"nome": "09 - Limpeza",              "icone": "🧹", "cor": "#10b981", "margem_padrao": 30.0},
    {"nome": "10 - Perfumaria e Higiene", "icone": "🧴", "cor": "#ec4899", "margem_padrao": 40.0},
    {"nome": "11 - Bazar",                "icone": "🛍️", "cor": "#6366f1", "margem_padrao": 40.0},
    {"nome": "12 - Pet Shop",             "icone": "🐾", "cor": "#d97706", "margem_padrao": 35.0},
    {"nome": "13 - Eletro",               "icone": "🔌", "cor": "#64748b", "margem_padrao": 25.0},
]

db = SessionLocal()
try:
    for dados in CATEGORIAS:
        # Procura por nome exato ou por número (ex: "01 -")
        prefixo = dados["nome"].split(" - ")[0]
        existing = db.query(CategoriaProduto).filter(
            CategoriaProduto.nome.like(f"{prefixo} -%")
        ).first()
        if existing:
            existing.nome          = dados["nome"]
            existing.icone         = dados["icone"]
            existing.cor           = dados["cor"]
            existing.margem_padrao = dados["margem_padrao"]
            existing.is_active     = True
            print(f"  ✓ Atualizado: {dados['nome']}")
        else:
            obj = CategoriaProduto(**dados)
            db.add(obj)
            print(f"  + Criado: {dados['nome']}")
    db.commit()
    print("\n✅ Categorias atualizadas com sucesso!")
finally:
    db.close()
