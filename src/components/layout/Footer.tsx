import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { useData } from '../../hooks/useData';
import { formatDateTime } from '../../lib/format';
import { QuietHint } from '../quiet-hint';
export function Footer(): JSX.Element {
  const { data } = useData();
  return <footer className="orbit-footer"><div><b>ORBIT<span className="text-brand">.</span></b><QuietHint text="维护活动与公开记录不代表软件质量、安全或兼容性保证。">公开数据 · 独立观察</QuietHint></div><div className="orbit-footer-meta"><Link to="/method">数据与方法 <ArrowUpRight size={13} /></Link><span>快照 {formatDateTime(data?.latest.lastSuccessAt)} · UTC+8</span><span>GitHub · npm · OSV</span></div></footer>;
}
