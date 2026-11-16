import { Copy, Eye, Pencil, RotateCw } from "lucide-react";
import { IconButton } from "./IconButton";
import type { ButtonHTMLAttributes } from "react";

export function CompactAction({ label, kind, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; kind: 'view' | 'edit' | 'copy' | 'refresh' }) {
  const Icon = { view: Eye, edit: Pencil, copy: Copy, refresh: RotateCw }[kind];
  return <IconButton {...props} label={label}><Icon size={16}/></IconButton>;
}
