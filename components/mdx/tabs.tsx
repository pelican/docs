'use client';

import { Children, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import { Tabs as TabsRoot } from 'fumadocs-ui/components/ui/tabs';
import { TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/tabs';
import { setStoredValue, useStoredValue } from '@/components/setup/store';

interface TabItemProps {
  value: string;
  label?: ReactNode;
  default?: boolean;
  children?: ReactNode;
}

/** One tab. Only meaningful inside <Tabs>, which reads its props. */
export function TabItem({ children }: TabItemProps) {
  return <>{children}</>;
}

/**
 * Docusaurus-style tabs:
 *
 *   <Tabs groupId="webserver">
 *     <TabItem value="nginx" label="NGINX" default>…</TabItem>
 *   </Tabs>
 *
 * Tabs with the same groupId switch together, across pages, and remember the
 * choice in the browser. The <SetupPanel /> writes to the same groups, so
 * picking "Caddy" there opens every Caddy tab.
 */
export function Tabs({
  groupId,
  defaultValue,
  children,
}: {
  groupId?: string;
  defaultValue?: string;
  /** Accepted for Docusaurus compatibility; not used. */
  queryString?: boolean | string;
  children?: ReactNode;
}) {
  const items = Children.toArray(children).filter(
    (child): child is ReactElement<TabItemProps> =>
      isValidElement<TabItemProps>(child) && typeof child.props.value === 'string',
  );
  const values = items.map((item) => item.props.value);
  const fallback = defaultValue ?? items.find((item) => item.props.default)?.props.value ?? values[0];

  const [local, setLocal] = useState(fallback);
  const shared = useStoredValue(groupId ? `tabs:${groupId}` : null);
  // A group value this set of tabs doesn't have (e.g. "Rocky Linux NGINX") is ignored.
  const active = shared && values.includes(shared) ? shared : local;

  return (
    <TabsRoot
      value={active}
      onValueChange={(value) => {
        setLocal(value);
        if (groupId) setStoredValue(`tabs:${groupId}`, value);
      }}
      className="my-4 flex flex-col overflow-hidden rounded-xl border bg-fd-secondary"
    >
      <TabsList>
        {items.map((item) => (
          <TabsTrigger key={item.props.value} value={item.props.value}>
            {item.props.label ?? item.props.value}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        // Every tab is in the HTML (hidden with CSS), so links into a closed tab
        // and the page's static HTML both still have its content.
        <TabsContent key={item.props.value} value={item.props.value} forceMount>
          {item.props.children}
        </TabsContent>
      ))}
    </TabsRoot>
  );
}
