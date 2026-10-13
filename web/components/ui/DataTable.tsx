import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react'

type DataTableDensity = 'compact' | 'default' | 'comfortable'

export type DataTableProps = TableHTMLAttributes<HTMLTableElement> & {
  density?: DataTableDensity
}

export function DataTable({ density = 'default', className = '', ...props }: DataTableProps) {
  return (
    <table
      className={['dz-data-table', `dz-data-table--${density}`, className].filter(Boolean).join(' ')}
      data-dz-table="true"
      {...props}
    />
  )
}

export function DataTableHead({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={['dz-data-table__head', className].filter(Boolean).join(' ')} {...props} />
}

export function DataTableBody({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={['dz-data-table__body', className].filter(Boolean).join(' ')} {...props} />
}

export function DataTableRow({ className = '', ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={['dz-data-table__row', className].filter(Boolean).join(' ')} {...props} />
}

export function DataTableHeaderCell({ className = '', ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={['dz-data-table__header-cell', className].filter(Boolean).join(' ')} {...props} />
}

export function DataTableCell({ className = '', ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={['dz-data-table__cell', className].filter(Boolean).join(' ')} {...props} />
}

type DataTableViewportProps = HTMLAttributes<HTMLDivElement> & {
  labelledBy?: string
}

export function DataTableViewport({ className = '', labelledBy, ...props }: DataTableViewportProps) {
  return (
    <div
      className={['dz-data-table-viewport', className].filter(Boolean).join(' ')}
      data-dz-table-viewport="true"
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
      {...props}
    />
  )
}
