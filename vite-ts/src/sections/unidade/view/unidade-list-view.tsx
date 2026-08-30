import type { IconifyName } from 'src/components/iconify';
import type { TableHeadCellProps } from 'src/components/table';

import { varAlpha } from 'minimal-shared/utils';
import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import TableBody from '@mui/material/TableBody';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';
import { type Unidade, listUnidades, solicitacoesPorUnidade } from 'src/lib/creche-api';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import {
  useTable,
  emptyRows,
  rowInPage,
  TableNoData,
  getComparator,
  TableEmptyRows,
  TableHeadCustom,
  TablePaginationCustom,
} from 'src/components/table';

import { UnidadeTableRow } from '../unidade-table-row';
import { UnidadeTableToolbar } from '../unidade-table-toolbar';

// ----------------------------------------------------------------------

const ANO_PROCESSO = new Date().getFullYear();

const TABLE_HEAD: TableHeadCellProps[] = [
  { id: 'nome', label: 'Nome' },
  { id: 'bairro', label: 'Bairro' },
  { id: 'cre', label: 'CRE' },
  { id: 'tipo_gestao', label: 'Gestão' },
  { id: 'solicitacoes', label: 'Solicitações', align: 'right' },
];

type StatCardProps = { title: string; total: number; icon: IconifyName; color: string };

function StatCard({ title, total, icon, color }: StatCardProps) {
  return (
    <Stack spacing={1} sx={{ px: 3, py: 2, minWidth: 160 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Iconify icon={icon} width={24} sx={{ color }} />
        <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
          {title}
        </Typography>
      </Stack>
      <Typography variant="h4">{total.toLocaleString('pt-BR')}</Typography>
    </Stack>
  );
}

export function UnidadeListView() {
  const theme = useTheme();
  const table = useTable({ defaultOrderBy: 'nome', defaultRowsPerPage: 10 });

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filterName, setFilterName] = useState('');
  const [filterTipo, setFilterTipo] = useState<'all' | 'Direta' | 'Parceria'>('all');

  useEffect(() => {
    Promise.all([listUnidades({ ativa: true }), solicitacoesPorUnidade(ANO_PROCESSO)])
      .then(([lista, contagem]) => {
        setUnidades(lista);
        setSolicitacoes(Object.fromEntries(contagem.map((c) => [c.unidade_id, c.total_solicitacoes])));
      })
      .finally(() => setLoading(false));
  }, []);

  const getLength = (tipo: 'Direta' | 'Parceria') => unidades.filter((u) => u.tipo_gestao === tipo).length;
  const comSolicitacao = Object.values(solicitacoes).filter((n) => n > 0).length;

  const TABS = [
    { value: 'all' as const, label: 'Todas', count: unidades.length },
    { value: 'Direta' as const, label: 'Diretas', count: getLength('Direta') },
    { value: 'Parceria' as const, label: 'Parceria', count: getLength('Parceria') },
  ];

  const handleFilterTipo = useCallback(
    (_event: React.SyntheticEvent, newValue: 'all' | 'Direta' | 'Parceria') => {
      table.onResetPage();
      setFilterTipo(newValue);
    },
    [table]
  );

  const dataFiltered = useMemo(() => {
    let data = unidades;
    if (filterTipo !== 'all') data = data.filter((u) => u.tipo_gestao === filterTipo);
    if (filterName) {
      const q = filterName.toLowerCase();
      data = data.filter((u) => u.nome.toLowerCase().includes(q) || u.bairro?.toLowerCase().includes(q));
    }
    const comparator = getComparator(table.order, table.orderBy as keyof Unidade);
    return [...data].sort(comparator as any);
  }, [unidades, filterTipo, filterName, table.order, table.orderBy]);

  const dataInPage = rowInPage(dataFiltered, table.page, table.rowsPerPage);
  const notFound = !dataFiltered.length;

  return (
    <DashboardContent>
      <CustomBreadcrumbs
        heading="Unidades de Creche"
        links={[{ name: 'Inscrição Creche' }, { name: 'Unidades' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ mb: { xs: 3, md: 5 } }}>
        <Scrollbar sx={{ minHeight: 108 }}>
          <Stack
            divider={<Divider orientation="vertical" flexItem sx={{ borderStyle: 'dashed' }} />}
            sx={{ py: 1, flexDirection: 'row' }}
          >
            <StatCard
              title="Total de unidades"
              total={unidades.length}
              icon="solar:home-angle-bold-duotone"
              color={theme.vars.palette.info.main}
            />
            <StatCard
              title="Rede direta"
              total={getLength('Direta')}
              icon="solar:flag-bold"
              color={theme.vars.palette.success.main}
            />
            <StatCard
              title="Parceria"
              total={getLength('Parceria')}
              icon="solar:verified-check-bold"
              color={theme.vars.palette.warning.main}
            />
            <StatCard
              title="Com solicitações"
              total={comSolicitacao}
              icon="solar:file-text-bold"
              color={theme.vars.palette.primary.main}
            />
          </Stack>
        </Scrollbar>
      </Card>

      <Card>
        <Tabs
          value={filterTipo}
          onChange={handleFilterTipo}
          sx={{
            px: { md: 2.5 },
            boxShadow: `inset 0 -2px 0 0 ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
          }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              iconPosition="end"
              icon={
                <Label variant={tab.value === filterTipo ? 'filled' : 'soft'} color="default">
                  {tab.count}
                </Label>
              }
            />
          ))}
        </Tabs>

        <UnidadeTableToolbar value={filterName} onChange={setFilterName} onResetPage={table.onResetPage} />

        <Box sx={{ position: 'relative' }}>
          <Scrollbar sx={{ minHeight: 444 }}>
            <Table size={table.dense ? 'small' : 'medium'} sx={{ minWidth: 720 }}>
              <TableHeadCustom
                order={table.order}
                orderBy={table.orderBy}
                headCells={TABLE_HEAD}
                rowCount={dataFiltered.length}
                onSort={table.onSort}
              />

              <TableBody>
                {loading
                  ? null
                  : dataInPage.map((row) => (
                      <UnidadeTableRow key={row.id} row={row} totalSolicitacoes={solicitacoes[row.id] ?? 0} />
                    ))}

                <TableEmptyRows
                  height={table.dense ? 56 : 56 + 20}
                  emptyRows={emptyRows(table.page, table.rowsPerPage, dataFiltered.length)}
                />

                <TableNoData notFound={!loading && notFound} />
              </TableBody>
            </Table>
          </Scrollbar>
        </Box>

        <TablePaginationCustom
          page={table.page}
          dense={table.dense}
          count={dataFiltered.length}
          rowsPerPage={table.rowsPerPage}
          onPageChange={table.onChangePage}
          onChangeDense={table.onChangeDense}
          onRowsPerPageChange={table.onChangeRowsPerPage}
        />
      </Card>
    </DashboardContent>
  );
}
