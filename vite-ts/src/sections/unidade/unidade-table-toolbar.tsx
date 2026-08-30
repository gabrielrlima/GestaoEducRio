import { useCallback } from 'react';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';

import { useTranslate } from 'src/locales';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type Props = {
  value: string;
  onResetPage: () => void;
  onChange: (value: string) => void;
};

export function UnidadeTableToolbar({ value, onChange, onResetPage }: Props) {
  const { t } = useTranslate('creche');

  const handleFilterName = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onResetPage();
      onChange(event.target.value);
    },
    [onResetPage, onChange]
  );

  return (
    <Box sx={{ p: 2.5, gap: 2, display: 'flex', alignItems: 'center' }}>
      <TextField
        fullWidth
        value={value}
        onChange={handleFilterName}
        placeholder={t('unidadesList.searchPlaceholder')}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}
