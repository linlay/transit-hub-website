import { credits } from "../lib/enterprise";
import { asRecord, recordFieldLabels } from "../lib/integration";
import { enterpriseValueLabel } from "../lib/enterprise-labels";
import { useI18n } from "../lib/i18n";
export function RecordValue({value,field='',depth=0,unit='Credits'}:{value:unknown;field?:string;depth?:number;unit?:string}){
 const {t}=useI18n();
 if(value==null||value==='')return <span className="muted-cell">—</span>;
 if(value==='[redacted]'||value==='[redacted document]')return <span className="pill muted">{t('Redacted')}</span>;
 const leaf=field.split('.').slice(-1)[0].toLowerCase();
 if(['api_key','password','secret','token','authorization','key','ciphertext'].includes(leaf))return <span className="pill muted">{t('Redacted')}</span>;
 if(typeof value==='boolean')return <span>{t(leaf==='enabled'?(value?'Enabled':'Disabled'):(value?'Yes':'No'))}</span>;
 if(/(?:microcredits|micros)(?:_|$)/.test(leaf))return <span>{credits(value)} {unit}</span>;
 if(Array.isArray(value))return value.length?<ul className="record-value-list">{value.map((item,index)=><li key={index}><RecordValue value={item} field={field} depth={depth+1} unit={unit}/></li>)}</ul>:<span>{t('None')}</span>;
 if(typeof value==='object'){if(depth>5)return <span>{t('Nested record')}</span>;return <dl className="record-value-object">{Object.entries(asRecord(value)).map(([key,item])=><div key={key}><dt>{t(recordFieldLabels[key]??key.replace(/_/g,' '))}</dt><dd><RecordValue value={item} field={key} depth={depth+1} unit={unit}/></dd></div>)}</dl>;}
 return <span>{t(enterpriseValueLabel(value))}</span>;
}
