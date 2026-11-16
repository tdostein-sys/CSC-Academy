export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page flex justify-center py-8 sm:py-14">
      <div className="card w-full max-w-md">{children}</div>
    </div>
  );
}
