import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-black text-gray-400 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🏏</span>
              <div>
                <p className="font-bold text-white">Bay Area</p>
                <p className="font-bold text-vv-violet -mt-1">Girls Cricket</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Empowering girls through cricket in the San Francisco Bay Area.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-1 text-sm">
              {[
                ["Players", "/players"],
                ["Schedule", "/schedule"],
                ["Results", "/results"],
                ["Hub League", "/hub-league"],
                ["Statistics", "/stats"],
                ["News", "/news"],
                ["About", "/about"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-vv-violet transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">Connect</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <a
                  href="mailto:info@bayareagirlscricket.com"
                  className="hover:text-vv-violet transition-colors"
                >
                  info@bayareagirlscricket.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} Bay Area Girls Cricket. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
