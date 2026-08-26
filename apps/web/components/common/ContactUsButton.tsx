import { HOUR_COFFEE_CONTACT_URL } from "../../lib/contact-config";

export function ContactUsButton({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <a
      className={`customer-contact-button ${iconOnly ? "whatsapp-help-button" : ""}`}
      href={HOUR_COFFEE_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={iconOnly ? "Need help? Contact us on WhatsApp" : "Contact Hour Coffee on WhatsApp"}
    >
      {iconOnly ? <>
        <svg aria-hidden="true" viewBox="0 0 32 32" focusable="false">
          <path fill="currentColor" d="M16 4a11.8 11.8 0 0 0-10.1 17.9L4.3 28l6.3-1.6A12 12 0 1 0 16 4Zm0 21.8c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.7 9.7 0 1 1 16 25.8Zm5.3-7.3c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.2l-.9 1.1c-.2.2-.4.2-.7.1-1.8-.9-3-1.7-4.2-3.8-.3-.5.3-.5.9-1.7.1-.2 0-.4 0-.6l-.9-2.2c-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.6.1-.9.4-.3.4-1.2 1.2-1.2 2.9s1.2 3.3 1.4 3.6c.2.2 2.4 3.7 5.9 5.2 2.2.9 3.1 1 4.2.8.7-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.2-.2-.4-.3-.7-.4Z" />
        </svg>
        <span className="whatsapp-help-tooltip" role="tooltip">Need help? Chat with us</span>
      </> : "Contact Us"}
    </a>
  );
}
