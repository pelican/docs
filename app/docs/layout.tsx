import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { docsOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';
import { DocsTopBar } from '@/components/docs/docs-top-bar';
import { SidebarModal } from '@/components/docs/sidebar-modal';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <div className="dt-root">
      <DocsTopBar />
      <DocsLayout tree={source.getPageTree()} {...docsOptions()}>
        <SidebarModal />
        {children}
      </DocsLayout>
    </div>
  );
}
