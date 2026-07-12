// The real Garm App mark — copied from the Garm App project's
// public/favicon.svg so both apps ship the exact same logo.
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Garm">
      <rect width="96" height="96" rx="22" fill="#0D0D0D" />
      <g fill="#FBF8F2" stroke="#0D0D0D" strokeWidth="4">
        <rect x="12" y="21" width="72" height="18" rx="9" />
        <rect x="12" y="57" width="72" height="18" rx="9" />
        <rect x="21" y="12" width="18" height="72" rx="9" />
        <rect x="57" y="12" width="18" height="72" rx="9" />
        <rect x="17" y="57" width="26" height="18" rx="9" />
        <rect x="53" y="21" width="26" height="18" rx="9" />
      </g>
    </svg>
  );
}
