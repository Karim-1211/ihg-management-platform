import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from "../../services/api";

export default function DeliveryAIAssistant() {
  const navigate = useNavigate()

  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! I can help you discover food, find suitable menu items, check an order, or reorder your previous delivery.',
    },
  ])
  const [loading, setLoading] = useState(false)

  async function sendMessage() {
    const text = message.trim()

    if (!text || loading) return

    setMessages((current) => [
      ...current,
      {
        role: 'user',
        text,
      },
    ])

    setMessage('')
    setLoading(true)

    try {
      const lower = text.toLowerCase()

      let response

      if (
        lower.includes('where is my order') ||
        lower.includes('track my order') ||
        lower.includes('order status')
      ) {
        const orderId = window.prompt(
          'Enter your order ID to check its current delivery status:'
        )

        if (!orderId) {
          setLoading(false)
          return
        }

        response = await api.post(
          `/ai/delivery/order-status/${orderId}`
        )
      } else if (
        lower.includes('reorder') ||
        lower.includes('last order') ||
        lower.includes('previous order')
      ) {
        response = await api.post('/ai/delivery/reorder')
      } else {
        response = await api.post('/ai/delivery/menu', {
          message: text,
        })
      }

      const data = response.data

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: data.message,
        },
      ])

      if (
        data.action === 'SHOW_MENU_ITEMS' &&
        data.restaurant_id
      ) {
        setTimeout(() => {
          navigate(
            `/delivery/restaurants/${data.restaurant_id}`,
            {
              state: {
                aiMenuItemIds: data.menu_item_ids,
              },
            }
          )
        }, 500)
      }

      if (data.action === 'VIEW_ORDER' && data.order_id) {
        setTimeout(() => {
          navigate(
            `/delivery/orders/${data.order_id}/tracking`
          )
        }, 500)
      }

      if (
        data.action === 'REORDER_REVIEW' &&
        data.restaurant_id
      ) {
        setTimeout(() => {
          navigate(
            `/delivery/restaurants/${data.restaurant_id}`,
            {
              state: {
                aiMenuItemIds: data.menu_item_ids,
                reorderFromOrderId: data.order_id,
              },
            }
          )
        }, 500)
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text:
            error.response?.data?.detail ||
            'I could not complete that request right now.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 rounded-full bg-[#1F3A5F] px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:scale-105"
        >
          💬 Ask Food Assistant
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[600px] w-[360px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between bg-[#1F3A5F] px-5 py-4 text-white">
            <div>
              <p className="font-semibold">
                Food Assistant
              </p>
              <p className="text-xs text-white/70">
                Menu & delivery help
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-2 py-1 text-xl hover:bg-white/10"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((item, index) => (
              <div
                key={index}
                className={
                  item.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#FF2147] px-4 py-3 text-sm text-white'
                    : 'mr-auto max-w-[90%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200'
                }
              >
                {item.text}
              </div>
            ))}

            {loading && (
              <div className="mr-auto rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                Thinking...
              </div>
            )}
          </div>

          <div className="border-t bg-white p-3">
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={(event) =>
                  setMessage(event.target.value)
                }
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Try: vegan food, spicy chicken..."
                className="min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#1F3A5F]"
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !message.trim()}
                className="self-end rounded-2xl bg-[#FF2147] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}