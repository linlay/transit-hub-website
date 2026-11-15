import { useState } from "react";
import { copyText } from "../lib/clipboard";
import { useI18n } from "../lib/i18n";
export function CopyValueButton({value,label}:{value:string;label:string}){
 const {t}=useI18n();const [result,setResult]=useState<boolean|null>(null);
 return <span className="copy-value-control"><button type="button" disabled={!value} onClick={async()=>setResult(await copyText(value))}>{label}</button>{result!==null&&<small role="status" className={result?'saved-text':'error-text'}>{t(result?'Copied.':'Copy failed.')}</small>}</span>;
}
