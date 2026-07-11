import React from 'react';
import { DataGrid } from '@mui/x-data-grid';
import { Box } from '@mui/material';

export default function CustomGrid({
  columns = [],
  data = [],
  loading = false,
  showCheckboxes = true,
  keyField = 'id',
  initialRowsPerPage = 13,
  onSelectionChange = null,
  emptyMessage = 'No records found.'
}) {
  // Map rows to include S.No and unique id for DataGrid
  const rows = data.map((row, idx) => {
    // Generate a fallback unique ID if keyField doesn't exist
    const rowId = row[keyField] !== undefined && row[keyField] !== null 
      ? row[keyField] 
      : `row-${idx}`;
      
    return {
      ...row,
      // DataGrid requires a unique 'id' field
      id: rowId,
      sNo: idx + 1
    };
  });

  // Map incoming columns to MUI DataGrid format
  const muiColumns = [
    {
      field: 'sNo',
      headerName: 'S.NO',
      width: 60,
      align: 'center',
      headerAlign: 'center',
      sortable: false,
      filterable: false,
      disableColumnMenu: true
    },
    ...columns.map(col => ({
      field: col.id,
      headerName: col.label,
      // If width is specified, use it; otherwise flex to fill space
      flex: col.width ? undefined : 1,
      width: col.width || undefined,
      sortable: true,
      filterable: true,
      // If there's a custom render, map it to renderCell
      renderCell: col.render ? (params) => col.render(params.row) : undefined
    }))
  ];

  return (
    <Box 
      sx={{ 
        width: '100%',
        // Set dynamic height or fallback height depending on number of rows to look extremely neat
        height: 520,
        minHeight: 250,
        '& .MuiDataGrid-root': {
          border: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'light' ? '#e2e8f0' : '#334155',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: 'background.paper',
        },
        '& .MuiDataGrid-columnHeaders': {
          backgroundColor: (theme) => theme.palette.mode === 'light' ? '#f8fafc' : '#0f172a',
          borderBottom: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'light' ? '#e2e8f0' : '#334155',
        },
        '& .MuiDataGrid-columnHeader': {
          color: (theme) => theme.palette.mode === 'light' ? '#0F2C59' : '#93C5FD',
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: '11px',
          letterSpacing: '0.05em',
          '&:focus': {
            outline: 'none',
          },
          '&:focus-within': {
            outline: 'none',
          }
        },
        '& .MuiDataGrid-cell': {
          fontSize: '12px',
          fontWeight: 500,
          color: 'text.primary',
          borderColor: (theme) => theme.palette.mode === 'light' ? '#e2e8f0' : '#334155',
          '&:focus': {
            outline: 'none',
          },
          '&:focus-within': {
            outline: 'none',
          }
        },
        '& .MuiDataGrid-row': {
          borderColor: (theme) => theme.palette.mode === 'light' ? '#e2e8f0' : '#334155',
          '&:hover': {
            backgroundColor: (theme) => theme.palette.mode === 'light' ? 'rgba(30, 64, 175, 0.03)' : 'rgba(147, 197, 253, 0.05)',
          }
        },
        '& .MuiDataGrid-footerContainer': {
          borderTop: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'light' ? '#e2e8f0' : '#334155',
          backgroundColor: 'background.paper',
          // Customize page range color in footer to red/orange
          '& .MuiTablePagination-displayedRows': {
            color: '#C2410C',
            fontWeight: 'bold',
          }
        }
      }}
    >
      <DataGrid
        rows={rows}
        columns={muiColumns}
        loading={loading}
        density="compact"
        checkboxSelection={showCheckboxes}
        disableRowSelectionOnClick
        showCellVerticalLines
        showColumnVerticalLines
        pageSizeOptions={[5, 10, 13, 20, 50]}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: initialRowsPerPage,
              page: 0
            },
          },
        }}
        onRowSelectionModelChange={(newSelectionModel) => {
          if (onSelectionChange) {
            onSelectionChange(newSelectionModel);
          }
        }}
        localeText={{
          noRowsLabel: emptyMessage,
        }}
      />
    </Box>
  );
}
