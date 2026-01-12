import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// import App from './App.jsx'　　　テスト用のjsxファイルの呼び出し
import VercelTest from './main/VercelTest'

createRoot(document.getElementById('root')).render(
  <VercelTest />   //VercelTestを呼び出す。
)
