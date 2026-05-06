import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  FileArchive,
  Github,
  KeyRound,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const plugins = [
  {
    id: "wordpress",
    name: "WordPress / WooCommerce Tracker",
    version: "1.0.4",
    platform: "WordPress",
    fileName: "wordpress-behaviour-tracker-1.0.4.zip",
    href: "/plugins/wordpress-behaviour-tracker-1.0.4.zip",
    size: "40 KB",
    sha256: "d7b09de2617c30e9a71246896eb034c40dd702cc705d3eb0bd2aaf2f9df712a4",
    sourceUrl: "https://github.com/GalylioAI/Client-Behaviour-Project/tree/wp",
    installArea: "WordPress admin -> Plugins -> Add New -> Upload Plugin",
    settingsArea: "Settings -> Behaviour Tracker",
  },
  {
    id: "prestashop",
    name: "PrestaShop Behaviour Tracker",
    version: "1.0.2",
    platform: "PrestaShop",
    fileName: "behaviourtracker-prestashop-1.0.2.zip",
    href: "/plugins/behaviourtracker-prestashop-1.0.2.zip",
    size: "44 KB",
    sha256: "e8fe990de77b1921636fa2afdabaccd5b77750f0be9f5be732508fe9d075aa9a",
    sourceUrl: "https://github.com/GalylioAI/Client-Behaviour-Project/tree/Prestashop_module",
    installArea: "PrestaShop admin -> Modules -> Module Manager -> Upload a module",
    settingsArea: "Modules -> Customer Behaviour Tracker -> Configure",
  },
]

function shortHash(value: string) {
  return `${value.slice(0, 12)}...${value.slice(-10)}`
}

function PluginCard({ plugin, siteId }: { plugin: (typeof plugins)[number]; siteId?: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-blue-700">
            <FileArchive className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-950">{plugin.name}</h2>
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                v{plugin.version}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Install this tracker on your {plugin.platform} store, then paste your `site_id` and public write key.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
          <ShieldCheck className="h-3 w-3" />
          Open source
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Install from</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{plugin.installArea}</div>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Configure at</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{plugin.settingsArea}</div>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">SHA-256 checksum</div>
            <code className="mt-1 block truncate text-xs font-medium text-slate-700" title={plugin.sha256}>
              {shortHash(plugin.sha256)}
            </code>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
            {plugin.size}
          </Badge>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild className="bg-blue-600 hover:bg-blue-700">
          <a href={plugin.href} download>
            <Download className="h-4 w-4" />
            Download ZIP
          </a>
        </Button>
        <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
          <a href={plugin.sourceUrl} target="_blank" rel="noreferrer">
            <Github className="h-4 w-4" />
            View Source
          </a>
        </Button>
        <Button asChild variant="outline" className={cn("border-slate-200 bg-white text-slate-700", !siteId && "opacity-70")}>
          <Link href={`/connect${siteId ? `?site_id=${encodeURIComponent(siteId)}` : ""}`}>
            <PlugZap className="h-4 w-4" />
            Connect
          </Link>
        </Button>
      </div>
    </article>
  )
}

export function DownloadsPage({ siteId }: { siteId?: string }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-600 text-white">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">Plugin Downloads</div>
              <div className="text-xs text-slate-500">Official tracker packages and source code</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
              <Link href="/start">
                <KeyRound className="h-4 w-4" />
                Start
              </Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href={`/connect${siteId ? `?site_id=${encodeURIComponent(siteId)}` : ""}`}>
                Connect Plugin
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] space-y-5 px-4 py-5 md:px-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-blue-100 bg-blue-50 text-blue-700">
                  WordPress 1.0.4 / PrestaShop 1.0.2
                </Badge>
                <Badge variant="outline" className="border-emerald-100 bg-emerald-50 text-emerald-700">
                  <Github className="h-3 w-3" />
                  Open source
                </Badge>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-[32px] md:leading-10">
                Download The Behaviour Tracker Plugins
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Customers can download the official plugin package, inspect the source code on GitHub, and verify the checksum before installing it.
              </p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-blue-700" />
                <div>
                  <div className="text-sm font-semibold text-blue-950">Trust note</div>
                  <p className="mt-1 text-sm leading-6 text-blue-900">
                    The plugins are open source. Users can check the code themselves before installing, so they know what is tracked and what is sent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {plugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} siteId={siteId} />
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div className="mt-3 text-sm font-semibold text-slate-950">1. Download</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">Choose the ZIP file that matches the customer store platform.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <LockKeyhole className="h-5 w-5 text-blue-600" />
            <div className="mt-3 text-sm font-semibold text-slate-950">2. Configure</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">Paste the `site_id`, public write key, and webhook URL from the access package.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <Code2 className="h-5 w-5 text-indigo-600" />
            <div className="mt-3 text-sm font-semibold text-slate-950">3. Verify</div>
            <p className="mt-1 text-sm leading-6 text-slate-600">Open the storefront and use the connection wizard/debugger to confirm live events.</p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Source Repositories</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">Direct GitHub branches for technical review.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                <a href={plugins[0].sourceUrl} target="_blank" rel="noreferrer">
                  WordPress
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button asChild variant="outline" className="border-slate-200 bg-white text-slate-700">
                <a href={plugins[1].sourceUrl} target="_blank" rel="noreferrer">
                  PrestaShop
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
