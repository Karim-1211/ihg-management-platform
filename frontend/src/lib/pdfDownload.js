import api from '../services/api'

// PDF endpoints require the bearer token, so a plain <a href> won't work —
// the file has to be fetched with the auth header and then handed to the
// browser as a blob.
async function fetchPdf(path) {
  const res = await api.get(path, { responseType: 'blob' })
  return new Blob([res.data], { type: 'application/pdf' })
}

export async function downloadPdf(path, filename) {
  const blob = await fetchPdf(path)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoke late: Safari aborts the download if the URL dies too soon.
  window.setTimeout(() => URL.revokeObjectURL(url), 10000)
}

export async function printPdf(path) {
  const blob = await fetchPdf(path)
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.src = url
  frame.onload = () => {
    try {
      frame.contentWindow.focus()
      frame.contentWindow.print()
    } catch {
      window.open(url, '_blank')
    }
  }
  document.body.appendChild(frame)
  window.setTimeout(() => {
    frame.remove()
    URL.revokeObjectURL(url)
  }, 60000)
}