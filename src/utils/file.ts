export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'

    let settled = false
    const finish = (file: File | null) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(file)
    }

    input.addEventListener('change', () => {
      finish(input.files?.[0] ?? null)
    })

    document.body.appendChild(input)
    input.click()

    // 用户取消选择时 change 可能不触发
    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(() => {
          if (!settled) finish(null)
        }, 500)
      },
      { once: true },
    )
  })
}
