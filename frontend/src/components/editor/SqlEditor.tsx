import CodeMirror from '@uiw/react-codemirror'
import { sql, MSSQL } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
  readOnly?: boolean
}

// MSSQL özel anahtar kelimeler
const mssqlDialect = MSSQL

// Editör teması — koyu arka plan, kolay okunur
const customTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  },
  '.cm-editor': {
    borderRadius: '0.5rem',
  },
  '.cm-scroller': {
    fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '10px 0',
    minHeight: '80px',
  },
  '.cm-line': {
    padding: '0 12px',
  },
  '.cm-placeholder': {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  // Aktif satır vurgusu
  '.cm-activeLine': {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  // Satır numaraları
  '.cm-gutters': {
    backgroundColor: '#0d0d0d',
    borderRight: '1px solid #27272a',
    color: '#52525b',
  },
  // Seçim
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(99, 102, 241, 0.3) !important',
  },
  // Cursor
  '.cm-cursor': {
    borderLeftColor: '#818cf8',
  },
})

export default function SqlEditor({ value, onChange, placeholder, minHeight = '120px', readOnly = false }: Props) {
  return (
    <div
      className="rounded-lg border border-border overflow-hidden focus-within:ring-2 focus-within:ring-primary"
      style={{ minHeight }}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={[
          sql({ dialect: mssqlDialect }),
          customTheme,
          EditorView.lineWrapping,
        ]}
        theme={oneDark}
        placeholder={placeholder}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          syntaxHighlighting: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          highlightSelectionMatches: false,
          closeBracketsKeymap: true,
          defaultKeymap: true,
          searchKeymap: false,
          historyKeymap: true,
          foldKeymap: false,
          completionKeymap: true,
          lintKeymap: false,
        }}
        style={{ minHeight }}
      />
    </div>
  )
}
