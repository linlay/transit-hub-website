import { forwardRef, type ButtonHTMLAttributes } from "react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "title"> & {
  label: string;
};

/** Keep the full action name available on hover and to assistive technology. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className = "icon-button", type = "button", children, ...props },
  ref,
) {
  return (
    <button {...props} ref={ref} type={type} className={`${className} action-icon`} aria-label={label} title={label}>
      {children}
    </button>
  );
});
