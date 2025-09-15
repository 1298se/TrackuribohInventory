export function AuthCenteredContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-60px)] w-full items-center justify-center">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
