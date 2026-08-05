import { HOUR_COFFEE_CONTACT_URL } from "../../lib/contact-config";

export function ContactUsButton() {
  return (
    <a
      className="customer-contact-button"
      href={HOUR_COFFEE_CONTACT_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact Hour Coffee on WhatsApp"
    >
      Contact Us
    </a>
  );
}
