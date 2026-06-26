'use client'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Printer, Check, RefreshCw, TestTube } from 'lucide-react'

const BLANK = {
  impressora_termica: '',
  impressora_nfe: '',
  impressora_etiqueta: '',
  largura_etiqueta_mm: 100,
  altura_etiqueta_mm: 150,
}

export default function ImpressorasPage() {
  const [form,    setForm]    = useState<any>(BLANK)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    api.get('/config/impressoras').then(r => setForm(r.data)).catch(() => {})
  }, [])

  async function salvar() {
    setSaving(true)
    try {
      await api.put('/config/impressoras', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) { alert(e.response?.data?.detail || 'Erro ao salvar') }
    setSaving(false)
  }

  function testePrint(tipo: 'termica' | 'nfe' | 'etiqueta') {
    const w = window.open('', '_blank', 'width=600,height=500')
    if (!w) return
    if (tipo === 'etiqueta') {
      w.document.write(`<html><head><title>Teste Etiqueta</title>
      <style>@page{size:${form.largura_etiqueta_mm}mm ${form.altura_etiqueta_mm}mm;margin:4mm}
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;width:${form.largura_etiqueta_mm}mm;min-height:${form.altura_etiqueta_mm}mm;padding:6mm;font-size:10pt}
      @media print{button{display:none}}</style></head><body>
      <div style="border:2px solid #F97316;border-radius:4mm;padding:4mm;height:calc(${form.altura_etiqueta_mm}mm - 16mm)">
        <div style="font-weight:900;font-size:13pt;color:#F97316">NexusVarejo</div>
        <div style="font-size:9pt;color:#888;margin:2mm 0">Etiqueta de Teste</div>
        <div style="font-size:11pt;font-weight:700">Cliente: João da Silva</div>
        <div style="font-size:9pt;color:#555;margin-top:2mm">Rua das Flores, 123 — Timbó/SC</div>
        <div style="font-family:monospace;letter-spacing:3px;background:#f3f4f6;padding:2mm;margin-top:3mm;font-size:11pt;border-radius:2mm">123456789012</div>
        <div style="font-size:8pt;color:#888;margin-top:3mm;display:flex;justify-content:space-between">
          <span>NexusVarejo</span><span>${new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>
      <br><button onclick="window.print()" style="width:100%;padding:8px;background:#F97316;color:white;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimir Etiqueta Teste</button>
      </body></html>`)
    } else if (tipo === 'nfe') {
      w.document.write(`<html><head><title>Teste NF-e</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;max-width:780px;margin:auto}
      @media print{button{display:none}}</style></head><body>
      <h2 style="color:#3B82F6">📄 NOTA FISCAL ELETRÔNICA — TESTE</h2>
      <p>Impressora configurada: <strong>${form.impressora_nfe || 'Não configurada'}</strong></p>
      <p>Este é um documento de teste. Em produção aqui aparecerá a DANFE da NF-e.</p>
      <table style="width:100%;margin-top:16px;border-collapse:collapse">
        <tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">Descrição</th><th style="padding:8px">Qtd</th><th style="padding:8px">Valor</th></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee">Produto Teste</td><td style="padding:8px;text-align:center;border-bottom:1px solid #eee">1</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee">R$ 100,00</td></tr>
      </table>
      <p style="text-align:right;margin-top:12px;font-size:16px;font-weight:900;color:#3B82F6">TOTAL: R$ 100,00</p>
      <br><button onclick="window.print()" style="padding:10px 20px;background:#3B82F6;color:white;border:none;border-radius:8px;cursor:pointer">🖨️ Imprimir Teste NF-e</button>
      </body></html>`)
    } else {
      w.document.write(`<html><head><title>Teste Cupom</title>
      <style>body{font-family:monospace;padding:16px;max-width:320px;margin:auto;font-size:13px}
      @media print{button{display:none}}</style></head><body>
      <div style="text-align:center;border-bottom:1px dashed #ccc;padding-bottom:8px;margin-bottom:8px">
        <strong style="font-size:15px">NexusVarejo</strong><br>
        Cupom de Teste<br>
        <small>Impressora: ${form.impressora_termica || 'Não configurada'}</small>
      </div>
      <div>Produto Teste ........... 1 x R$ 10,00</div>
      <div style="border-top:1px dashed #ccc;margin-top:8px;padding-top:8px;font-weight:700">
        TOTAL: R$ 10,00
      </div>
      <div style="text-align:center;margin-top:8px;font-size:11px;color:#888">
        ${new Date().toLocaleString('pt-BR')}
      </div>
      <br><button onclick="window.print()" style="width:100%;padding:8px;background:#F59E0B;color:white;border:none;border-radius:6px;cursor:pointer">🖨️ Imprimir Teste Cupom</button>
      </body></html>`)
    }
    w.document.close(); w.focus()
    setTimeout(() => w.print(), 400)
  }

  const f = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }))
  const inp = "w-full px-3 py-2.5 text-sm rounded-xl"

  return (
    <div className="pg">
      <div className="pg-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-black text-white flex items-center gap-2">
            <Printer size={18} color="#F97316" /> Configuração de Impressoras
          </h1>
          <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Configure as impressoras utilizadas pelo sistema
          </p>
        </div>
        <button onClick={salvar} disabled={saving}
          className="btn-primary flex items-center gap-1.5 text-xs py-1.5 px-4">
          {saved ? <><Check size={12} /> Salvo!</> : <><RefreshCw size={12} className={saving ? 'animate-spin' : ''} /> {saving ? 'Salvando...' : 'Salvar'}</>}
        </button>
      </div>

      <div className="pg-body max-w-2xl space-y-4">

        {/* Impressora Térmica PDV */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.15)' }}>
                <span className="text-xl">🧾</span>
              </div>
              <div>
                <p className="font-black text-white">Impressora Térmica PDV</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Cupons de venda e comprovantes</p>
              </div>
            </div>
            <button onClick={() => testePrint('termica')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              <TestTube size={11} /> Teste
            </button>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME DA IMPRESSORA (como aparece no Windows)</label>
            <input value={form.impressora_termica || ''} onChange={e => f('impressora_termica', e.target.value)}
              className={inp} placeholder="Ex: Elgin i9, Bematech MP-4200" />
            <p className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>
              💡 Painel de Controle → Dispositivos e Impressoras → veja o nome exato da impressora
            </p>
          </div>
        </div>

        {/* Impressora NF-e / Relatórios */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(59,130,246,0.15)' }}>
                <span className="text-xl">📄</span>
              </div>
              <div>
                <p className="font-black text-white">Impressora NF-e / Relatórios</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Notas fiscais (DANFE), relatórios e documentos A4</p>
              </div>
            </div>
            <button onClick={() => testePrint('nfe')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.3)' }}>
              <TestTube size={11} /> Teste
            </button>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME DA IMPRESSORA</label>
            <input value={form.impressora_nfe || ''} onChange={e => f('impressora_nfe', e.target.value)}
              className={inp} placeholder="Ex: HP LaserJet, Epson L3150" />
          </div>
        </div>

        {/* Impressora Etiqueta */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(139,92,246,0.15)' }}>
                <span className="text-xl">🏷️</span>
              </div>
              <div>
                <p className="font-black text-white">Impressora de Etiquetas</p>
                <p className="text-[10px]" style={{ color: 'var(--muted)' }}>Etiquetas de envio Marketplace (USB térmica)</p>
              </div>
            </div>
            <button onClick={() => testePrint('etiqueta')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.3)' }}>
              <TestTube size={11} /> Teste
            </button>
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>NOME DA IMPRESSORA</label>
            <input value={form.impressora_etiqueta || ''} onChange={e => f('impressora_etiqueta', e.target.value)}
              className={inp} placeholder="Ex: Argox OS-2140, Zebra ZD220" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>LARGURA (mm)</label>
              <input type="number" min={50} max={200} value={form.largura_etiqueta_mm}
                onChange={e => f('largura_etiqueta_mm', parseInt(e.target.value) || 100)}
                className={inp} />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted)' }}>ALTURA (mm)</label>
              <input type="number" min={50} max={300} value={form.altura_etiqueta_mm}
                onChange={e => f('altura_etiqueta_mm', parseInt(e.target.value) || 150)}
                className={inp} />
            </div>
          </div>
          <p className="text-[10px] p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6' }}>
            💡 Tamanho padrão para impressora USB térmica: <strong>100mm × 150mm</strong>. Configure o tamanho no diálogo de impressão do Windows antes de imprimir.
          </p>
        </div>

        {/* Instrução geral */}
        <div className="rounded-2xl p-4 text-sm" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B' }}>
          <p className="font-bold mb-1">📌 Como configurar a impressora no Windows</p>
          <ol className="space-y-1 text-xs ml-3 list-decimal" style={{ color: '#A1A1AA' }}>
            <li>Abra o <strong>Painel de Controle → Dispositivos e Impressoras</strong></li>
            <li>Copie o <strong>nome exato</strong> da impressora e cole nos campos acima</li>
            <li>Ao imprimir, uma janela de diálogo será aberta — selecione a impressora correta</li>
            <li>Para impressão automática no futuro, configure a impressora como <strong>padrão do Windows</strong></li>
          </ol>
        </div>

      </div>
    </div>
  )
}
