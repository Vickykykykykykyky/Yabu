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

export function pickImageFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.multiple = true
    input.style.display = 'none'

    let settled = false
    const finish = (files: File[]) => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }

    input.addEventListener('change', () => {
      finish(Array.from(input.files ?? []))
    })

    document.body.appendChild(input)
    input.click()

    window.addEventListener(
      'focus',
      () => {
        window.setTimeout(() => {
          if (!settled) finish([])
        }, 500)
      },
      { once: true },
    )
  })
}
