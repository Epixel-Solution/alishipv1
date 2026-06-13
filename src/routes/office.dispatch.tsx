import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/office/dispatch')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/office/dispatch"!</div>
}
