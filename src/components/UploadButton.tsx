import './UploadButton.css'

type Props = {
  onClick: () => void
}

export function UploadButton({ onClick }: Props) {
  return (
    <button
      type="button"
      className="upload-button"
      onClick={onClick}
      aria-label="上传照片"
      title="上传照片"
    >
      <span className="upload-button__icon" aria-hidden>
        +
      </span>
    </button>
  )
}
