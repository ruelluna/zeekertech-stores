/**
 * A store's contact as owners type it: a Facebook Page or other link becomes a link, a mobile number
 * becomes a tap-to-call link, anything else is shown as written.
 */
export function ContactLink({ contact }: { contact: string }) {
  const text = contact.trim();
  const className = "underline hover:text-orange-700";

  if (/^(https?:\/\/|www\.|(m\.)?facebook\.com\/|fb\.com\/|m\.me\/)/i.test(text) && !/\s/.test(text)) {
    const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {text.replace(/^https?:\/\/(www\.)?/i, "")}
      </a>
    );
  }

  const digits = text.replace(/[\s()-]/g, "");
  if (/^\+?\d{7,15}$/.test(digits)) {
    return (
      <a href={`tel:${digits}`} className={className}>
        {text}
      </a>
    );
  }

  return <>{text}</>;
}
