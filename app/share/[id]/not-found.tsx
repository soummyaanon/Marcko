import { FileX, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileX className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">Document Not Found</h1>
          <p className="max-w-md text-muted-foreground">
            The document you&apos;re looking for doesn&apos;t exist or may have been removed.
          </p>
        </div>
        <Button asChild className="gap-2">
          <a href="/">
            <ArrowLeft className="h-4 w-4" />
            Go to Editor
          </a>
        </Button>
      </div>
    </div>
  )
}
