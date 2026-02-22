const links = [
  { label: "X", href: "https://x.com/project0" },
  { label: "Support", href: "https://discord.com/invite/c2kNj7y9w8" },
  { label: "Blog", href: "https://blog.0.xyz" },
  { label: "Github", href: "https://github.com/0dotxyz" },
  { label: "Audits", href: "https://www.0.xyz/audits" },
  {
    label: "Media Kit",
    href: "https://drive.google.com/drive/folders/1uoGoNXB-GjVLD7JoASMT_tetXZt57pp7",
  },
];

const legal = [
  { label: "Privacy", href: "https://www.0.xyz/privacy-policy" },
  { label: "Terms", href: "https://www.0.xyz/terms-of-use" },
];

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <div className="relative">
      {/* Footer background SVG */}
      <div className="absolute bottom-0 left-1/2 hidden h-[260px] w-[2560px] -translate-x-1/2 md:block">
        <img
          src="/images/backgrounds/dark/footer.svg"
          alt=""
          width="2560"
          height="260"
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>

      <footer
        className="mt-8 flex h-[140px] flex-col justify-end px-4 pb-8 font-mono text-xs uppercase text-white md:min-h-[260px] md:px-12"
        style={{
          background:
            "linear-gradient(360deg, var(--footer-gradient-4) 0%, var(--footer-gradient-3) 25%, var(--footer-gradient-2) 60%, var(--footer-gradient-1) 100%)",
        }}
      >
        <div className="relative flex flex-col items-center justify-between gap-4 md:flex-row">
          {/* Copyright (desktop) */}
          <div className="hidden md:block lg:w-1/3">
            <p>&copy; {year} Project 0</p>
          </div>

          {/* Links */}
          <div className="flex justify-center lg:w-1/3">
            <ul className="flex items-center gap-4">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-white/70"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + mobile copyright */}
          <div className="flex justify-end lg:w-1/3">
            <ul className="flex flex-wrap items-center justify-center gap-4 md:flex-nowrap md:gap-8">
              <li className="block md:hidden">
                <p>&copy; {year} Project 0</p>
              </li>
              {legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-white/70"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
