'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Box,
    Typography,
    Button,
    IconButton,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Autocomplete,
} from '@mui/material';
import {
    Close as CloseIcon,
    Home as HomeIcon,
} from '@mui/icons-material';
import { addressService, Province, District, Ward } from '@/services/address.service';
import { AddressType } from '@/types/account';

interface AddressPickerModalProps {
    open: boolean;
    onClose: () => void;
    onSave: (address: AddressType) => void;
    existingAddress?: AddressType;
}

export default function AddressPickerModal({ open, onClose, onSave, existingAddress }: AddressPickerModalProps) {
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);

    const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
    const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
    const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
    const [detailAddress, setDetailAddress] = useState('');
    const [label, setLabel] = useState('Nhà');

    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loadingWards, setLoadingWards] = useState(false);

    // Fetch provinces on mount
    useEffect(() => {
        const fetchProvinces = async () => {
            try {
                setLoadingProvinces(true);
                const data = await addressService.getProvinces();
                setProvinces(data);
            } catch (error) {
                console.error('Error fetching provinces:', error);
            } finally {
                setLoadingProvinces(false);
            }
        };

        if (open) {
            fetchProvinces();
        }
    }, [open]);

    // Fetch districts when province changes
    useEffect(() => {
        const fetchDistricts = async () => {
            if (!selectedProvince) {
                setDistricts([]);
                return;
            }
            try {
                setLoadingDistricts(true);
                const data = await addressService.getDistrictsByProvince(selectedProvince.code);
                setDistricts(data);
            } catch (error) {
                console.error('Error fetching districts:', error);
            } finally {
                setLoadingDistricts(false);
            }
        };

        fetchDistricts();
        setSelectedDistrict(null);
        setSelectedWard(null);
    }, [selectedProvince]);

    // Fetch wards when district changes
    useEffect(() => {
        const fetchWards = async () => {
            if (!selectedDistrict) {
                setWards([]);
                return;
            }
            try {
                setLoadingWards(true);
                const data = await addressService.getWardsByDistrict(selectedDistrict.code);
                setWards(data);
            } catch (error) {
                console.error('Error fetching wards:', error);
            } finally {
                setLoadingWards(false);
            }
        };

        fetchWards();
        setSelectedWard(null);
    }, [selectedDistrict]);

    // Reset form when modal closes
    useEffect(() => {
        if (!open) {
            setSelectedProvince(null);
            setSelectedDistrict(null);
            setSelectedWard(null);
            setDetailAddress('');
            setLabel('Nhà');
            setDistricts([]);
            setWards([]);
        }
    }, [open]);

    // Pre-fill form if editing existing address
    useEffect(() => {
        if (open && existingAddress && provinces.length > 0) {
            const province = provinces.find(p => p.code === existingAddress.province.code);
            if (province) {
                setSelectedProvince(province);
            }
            setDetailAddress(existingAddress.detailAddress || '');
            setLabel(existingAddress.label || 'Nhà');
        }
    }, [open, existingAddress, provinces]);

    const handleSave = () => {
        if (!selectedProvince || !selectedDistrict || !selectedWard) {
            return;
        }

        const newAddress: AddressType = {
            label,
            province: { code: selectedProvince.code, name: selectedProvince.name },
            district: { code: selectedDistrict.code, name: selectedDistrict.name },
            ward: { code: selectedWard.code, name: selectedWard.name },
            detailAddress,
            isDefault: false,
        };

        onSave(newAddress);
        onClose();
    };

    const isValid = selectedProvince && selectedDistrict && selectedWard;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    bgcolor: 'white',
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e4e6eb' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HomeIcon sx={{ color: '#1877f2' }} />
                    <Typography variant="h6" fontWeight={700} color="#050505">
                        {existingAddress ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}
                    </Typography>
                </Box>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {/* Label */}
                    <FormControl fullWidth size="small">
                        <InputLabel>Nhãn</InputLabel>
                        <Select
                            value={label}
                            label="Nhãn"
                            onChange={(e) => setLabel(e.target.value)}
                        >
                            <MenuItem value="Nhà">Nhà</MenuItem>
                            <MenuItem value="Văn phòng">Văn phòng</MenuItem>
                            <MenuItem value="Khác">Khác</MenuItem>
                        </Select>
                    </FormControl>

                    {/* Province */}
                    <Autocomplete
                        options={provinces}
                        getOptionLabel={(option) => option.name}
                        value={selectedProvince}
                        onChange={(_, value) => setSelectedProvince(value)}
                        loading={loadingProvinces}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Tỉnh/Thành phố"
                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {loadingProvinces ? <CircularProgress color="inherit" size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        noOptionsText="Không tìm thấy"
                    />

                    {/* District */}
                    <Autocomplete
                        options={districts}
                        getOptionLabel={(option) => option.name}
                        value={selectedDistrict}
                        onChange={(_, value) => setSelectedDistrict(value)}
                        loading={loadingDistricts}
                        disabled={!selectedProvince}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Quận/Huyện"
                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {loadingDistricts ? <CircularProgress color="inherit" size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        noOptionsText="Không tìm thấy"
                    />

                    {/* Ward */}
                    <Autocomplete
                        options={wards}
                        getOptionLabel={(option) => option.name}
                        value={selectedWard}
                        onChange={(_, value) => setSelectedWard(value)}
                        loading={loadingWards}
                        disabled={!selectedDistrict}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Phường/Xã"
                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {loadingWards ? <CircularProgress color="inherit" size={20} /> : null}
                                            {params.InputProps.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        )}
                        noOptionsText="Không tìm thấy"
                    />

                    {/* Detail Address */}
                    <TextField
                        label="Địa chỉ chi tiết (số nhà, tên đường...)"
                        size="small"
                        fullWidth
                        value={detailAddress}
                        onChange={(e) => setDetailAddress(e.target.value)}
                        placeholder="VD: Số 123, Đường ABC"
                    />

                    {/* Preview */}
                    {isValid && (
                        <Box sx={{ p: 2, bgcolor: '#f0f2f5', borderRadius: 2 }}>
                            <Typography fontSize={12} color="#65676b" gutterBottom>
                                Địa chỉ của bạn:
                            </Typography>
                            <Typography fontSize={14} color="#050505" fontWeight={500}>
                                {detailAddress && `${detailAddress}, `}
                                {selectedWard?.name}, {selectedDistrict?.name}, {selectedProvince?.name}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e4e6eb' }}>
                <Button
                    onClick={onClose}
                    sx={{ textTransform: 'none', color: '#65676b' }}
                >
                    Hủy
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={!isValid}
                    sx={{
                        bgcolor: '#1877f2',
                        textTransform: 'none',
                        fontWeight: 600,
                        '&:hover': { bgcolor: '#166fe5' },
                        '&:disabled': { bgcolor: '#e4e6eb' }
                    }}
                >
                    Lưu
                </Button>
            </DialogActions>
        </Dialog>
    );
}
