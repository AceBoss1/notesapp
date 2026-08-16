export default function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className="inline-block flex-shrink-0 align-middle"
      role="img"
      aria-label="Verified"
    >
      <title>Verified</title>
      <path
        d="M10 0l2.245 1.183 2.523-.29 1.183 2.245L18.196 4.35l-.29 2.523L19.09 9.09l-1.184 2.245.29 2.523-2.245 1.184-1.183 2.245-2.523-.29L10 18.18l-2.245-1.184-2.523.29-1.183-2.245-2.245-1.184.29-2.523L.906 9.09l1.184-2.245-.29-2.523L4.045 3.138l1.183-2.245 2.523.29L10 0z"
        fill="#7A0328"
      />
      <path
        d="M6 10l2.5 2.5L14 7"
        stroke="#FBF6F2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
