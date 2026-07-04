'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, UserPlus, Plus, Trash2, Wand2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/labels'
import { GARMENTS, GARMENT_ORDER, StyleControl } from '@/lib/garments'
import { ALL_UNITS, UNIT_LABELS, fromBase, round2 } from '@/lib/units'
import type { Customer, Fabric, FabricUnit, GarmentType, NewOrderItemInput } from '@/lib/types'
import { PageHeader, Field, Spinner } from '@/components/ui'
import CustomerModal from '@/components/CustomerModal'
import {
  PaymentLinesEditor,
  newPayLine,
  payTotal,
  toPaymentLines,
  type PayLine
} from '@/components/PaymentLinesEditor'
import { bdt, todayStr } from '@/lib/format'

interface ItemForm {
  key: number
  garment_type: GarmentType
  measurements: Record<string, string>
  style_options: Record<string, unknown>
  fabric_id: number | null
  fabric_quantity_used: string
  fabric_unit: FabricUnit | null
  price: string
}

let itemKey = 0
function blankItem(type: GarmentType): ItemForm {
  return {
    key: ++itemKey,
    garment_type: type,
    measurements: {},
    style_options: {},
    fabric_id: null,
    fabric_quantity_used: '',
    fabric_unit: null,
    price: ''
  }
}

export default function NewOrderPage(): JSX.Element {
  const toast = useToast()
  const router = useRouter()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [fabrics, setFabrics] = useState<Fabric[]>([])
  const [items, setItems] = useState<ItemForm[]>([blankItem('coat')])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [discount, setDiscount] = useState('')
  const [payLines, setPayLines] = useState<PayLine[]>([newPayLine('cash')])
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.fabrics.list().then(setFabrics).catch((e) => toast.error(e.message))
  }, [])

  const subtotal = useMemo(
    () => round2(items.reduce((s, it) => s + (Number(it.price) || 0), 0)),
    [items]
  )
  const discountVal = round2(Math.min(Math.max(0, Number(discount) || 0), subtotal))
  const total = round2(subtotal - discountVal)
  const amountPaid = round2(payTotal(payLines))
  const due = round2(Math.max(0, total - amountPaid))

  const addItem = (): void => setItems((prev) => [...prev, blankItem('coat')])
  const removeItem = (key: number): void =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev))
  const updateItem = (key: number, patch: Partial<ItemForm>): void =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const submit = async (): Promise<void> => {
    if (!customer) {
      toast.error('Select or add a customer first')
      return
    }
    setBusy(true)
    try {
      const payloadItems: NewOrderItemInput[] = items.map((it) => ({
        garment_type: it.garment_type,
        measurements: Object.fromEntries(
          Object.entries(it.measurements).map(([k, v]) => [k, v === '' ? null : Number(v)])
        ),
        style_options: it.style_options,
        fabric_id: it.fabric_id,
        fabric_quantity_used: it.fabric_quantity_used === '' ? null : Number(it.fabric_quantity_used),
        fabric_unit: it.fabric_id ? it.fabric_unit : null,
        price: Number(it.price) || 0
      }))

      const order = await api.orders.create({
        customer_id: customer.id,
        expected_delivery_date: deliveryDate || null,
        discount: discountVal,
        payments: toPaymentLines(payLines),
        due_date: dueDate || deliveryDate || null,
        status: 'received',
        items: payloadItems
      })
      toast.success(`Order #${order.id} created — stock deducted, SMS logged`)
      router.push(`/orders/${order.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('new_order')} subtitle="Capture the customer, garments and payment" />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CustomerPicker customer={customer} onSelect={setCustomer} />

          {items.map((item, idx) => (
            <GarmentCard
              key={item.key}
              index={idx}
              item={item}
              fabrics={fabrics}
              customer={customer}
              onChange={(patch) => updateItem(item.key, patch)}
              onRemove={() => removeItem(item.key)}
              canRemove={items.length > 1}
            />
          ))}

          <button className="btn-secondary w-full" onClick={addItem}>
            <Plus size={18} /> Add another garment
          </button>
        </div>

        <div className="space-y-4">
          <div className="card sticky top-6 p-5">
            <h3 className="mb-4 font-semibold text-gray-800">Order summary</h3>

            <Field label={t('delivery_date')}>
              <input
                type="date"
                className="input"
                value={deliveryDate}
                min={todayStr()}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </Field>

            <div className="my-4 space-y-2 border-y border-gray-100 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-semibold">{bdt(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Discount</span>
                <input
                  type="number"
                  className="input w-28 text-right"
                  value={discount}
                  placeholder="0"
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="text-gray-500">{t('total_price')}</span>
                <span className="font-semibold">{bdt(total)}</span>
              </div>
            </div>

            <Field label="Payment received" hint="Split across cash + card/MFS if needed">
              <PaymentLinesEditor lines={payLines} onChange={setPayLines} />
            </Field>

            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('amount_paid')}</span>
                <span className="font-semibold">{bdt(amountPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('due_amount')}</span>
                <span className={`font-semibold ${due > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                  {bdt(due)}
                </span>
              </div>
            </div>

            {due > 0 && (
              <Field label={t('due_date')} hint="Defaults to the delivery date">
                <input
                  type="date"
                  className="input"
                  value={dueDate || deliveryDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            )}

            <button className="btn-primary mt-4 w-full" onClick={submit} disabled={busy}>
              {busy ? <Spinner /> : 'Confirm order'}
            </button>
            <p className="mt-2 text-center text-xs text-gray-400">
              Confirming deducts fabric stock and logs a confirmation SMS.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function CustomerPicker({
  customer,
  onSelect
}: {
  customer: Customer | null
  onSelect: (c: Customer | null) => void
}): JSX.Element {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>([])
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const id = setTimeout(() => {
      api.customers.list(query).then(setResults).catch((e) => toast.error(e.message))
    }, 200)
    return () => clearTimeout(id)
  }, [query])

  return (
    <div className="card p-5">
      <h3 className="mb-3 font-semibold text-gray-800">Customer</h3>
      {customer ? (
        <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-3">
          <div>
            <div className="font-medium text-gray-900">{customer.name}</div>
            <div className="text-sm text-gray-500">{customer.phone}</div>
          </div>
          <button
            className="btn-ghost"
            onClick={() => {
              setQuery('')
              onSelect(null)
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              className="input pl-9"
              placeholder="Search existing customer by name or phone…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
            />
            {open && results.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {results.map((c) => (
                  <button
                    key={c.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => {
                      onSelect(c)
                      setOpen(false)
                    }}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-gray-500">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn-secondary shrink-0" onClick={() => setModal(true)}>
            <UserPlus size={18} /> New
          </button>
        </div>
      )}

      <CustomerModal
        open={modal}
        customer={null}
        onClose={() => setModal(false)}
        onSaved={(c) => {
          setModal(false)
          onSelect(c)
        }}
      />
    </div>
  )
}

function GarmentCard({
  index,
  item,
  fabrics,
  customer,
  onChange,
  onRemove,
  canRemove
}: {
  index: number
  item: ItemForm
  fabrics: Fabric[]
  customer: Customer | null
  onChange: (patch: Partial<ItemForm>) => void
  onRemove: () => void
  canRemove: boolean
}): JSX.Element {
  const toast = useToast()
  const def = GARMENTS[item.garment_type]

  const setType = (type: GarmentType): void => {
    onChange({ garment_type: type, measurements: {}, style_options: {} })
  }

  const setMeasure = (key: string, value: string): void => {
    onChange({ measurements: { ...item.measurements, [key]: value } })
  }

  const setStyle = (key: string, value: unknown): void => {
    onChange({ style_options: { ...item.style_options, [key]: value } })
  }

  const prefill = async (): Promise<void> => {
    if (!customer) {
      toast.error('Select a customer first')
      return
    }
    const last = await api.customers.lastMeasurements(customer.id, item.garment_type)
    if (!last) {
      toast.info('No previous measurements found for this customer')
      return
    }
    const asStrings: Record<string, string> = {}
    for (const [k, v] of Object.entries(last)) asStrings[k] = v == null ? '' : String(v)
    onChange({ measurements: asStrings })
    toast.success('Loaded last measurements')
  }

  const selectedFabric = fabrics.find((f) => f.id === item.fabric_id) || null

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            {index + 1}
          </span>
          <div className="flex gap-1">
            {GARMENT_ORDER.map((g) => (
              <button
                key={g}
                className={item.garment_type === g ? 'chip-on' : 'chip-off'}
                onClick={() => setType(g)}
              >
                {t(g)}
              </button>
            ))}
          </div>
        </div>
        {canRemove && (
          <button className="btn-ghost text-red-600" onClick={onRemove}>
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Measurements (inches)</h4>
          <button className="btn-ghost text-xs" onClick={prefill}>
            <Wand2 size={14} /> Use last measurements
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {def.measurements.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs text-gray-500">{f.label}</label>
              <input
                type="number"
                step="0.25"
                className="input"
                value={item.measurements[f.key] ?? ''}
                onChange={(e) => setMeasure(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-gray-700">Style options</h4>
        <div className="space-y-3">
          {def.style.map((ctrl) => (
            <StyleControlView
              key={ctrl.key}
              ctrl={ctrl}
              values={item.style_options}
              onChange={setStyle}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 border-t border-gray-100 pt-4">
        <div className="col-span-5">
          <label className="mb-1 block text-xs text-gray-500">{t('fabric_used')}</label>
          <select
            className="input"
            value={item.fabric_id ?? ''}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : null
              const fab = fabrics.find((f) => f.id === id)
              onChange({ fabric_id: id, fabric_unit: fab ? fab.unit : null })
            }}
          >
            <option value="">— none —</option>
            {fabrics.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({round2(fromBase(f.quantity_base, f.unit))} {f.unit} left)
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-gray-500">{t('quantity')}</label>
          <input
            type="number"
            step="0.1"
            className="input"
            disabled={!item.fabric_id}
            value={item.fabric_quantity_used}
            onChange={(e) => onChange({ fabric_quantity_used: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-xs text-gray-500">{t('unit')}</label>
          <select
            className="input"
            disabled={!item.fabric_id}
            value={item.fabric_unit ?? selectedFabric?.unit ?? 'gaz'}
            onChange={(e) => onChange({ fabric_unit: e.target.value as FabricUnit })}
          >
            {ALL_UNITS.map((u) => (
              <option key={u} value={u}>
                {UNIT_LABELS[u].split(' ')[0]}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-3">
          <label className="mb-1 block text-xs text-gray-500">{t('price')} (৳)</label>
          <input
            type="number"
            className="input"
            value={item.price}
            placeholder="0"
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}

function StyleControlView({
  ctrl,
  values,
  onChange
}: {
  ctrl: StyleControl
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}): JSX.Element | null {
  if (ctrl.type === 'toggle') {
    const on = Boolean(values[ctrl.key])
    return (
      <button
        className={on ? 'chip-on' : 'chip-off'}
        onClick={() => onChange(ctrl.key, !on)}
        type="button"
      >
        {ctrl.label}
      </button>
    )
  }

  if (ctrl.showWhen && !ctrl.showWhen(values)) return null
  const current = values[ctrl.key]
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-gray-500">{ctrl.label}</div>
      <div className="flex flex-wrap gap-2">
        {ctrl.options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={current === o.value ? 'chip-on' : 'chip-off'}
            onClick={() => onChange(ctrl.key, current === o.value ? '' : o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
