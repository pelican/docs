import './home.css';

/** Homepage, /eggs, /support and /faq: the V12 "B v3" design (fonts load in the root layout). */
export default function LandingLayout({ children }: LayoutProps<'/'>) {
  return <div className="pl">{children}</div>;
}
