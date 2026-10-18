import Link from "next/link";
import { Wordmark } from "./brand";
export function PlatformFooter() {
  return (
    <footer className="platform-footer">
      <Link href="/">
        <Wordmark />
        <small className="by-ova">By Ontario Volleyball Association</small>
      </Link>
      <nav className="footer-socials" aria-label="OVA social media">
        <a
          href="https://www.instagram.com/ova_updates/"
          target="_blank"
          rel="noreferrer"
        >
          Instagram
        </a>
        <a
          href="https://www.facebook.com/OntarioVolleyball/"
          target="_blank"
          rel="noreferrer"
        >
          Facebook
        </a>
        <a href="https://x.com/ova_updates" target="_blank" rel="noreferrer">
          X
        </a>
        <a
          href="https://www.youtube.com/user/TheOVAUpdates"
          target="_blank"
          rel="noreferrer"
        >
          YouTube
        </a>
        <a
          href="https://www.tiktok.com/@ova_updates"
          target="_blank"
          rel="noreferrer"
        >
          TikTok
        </a>
        <a href="mailto:info@ontariovolleyball.org">Contact</a>
      </nav>
    </footer>
  );
}
