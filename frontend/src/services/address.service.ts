import axios from "axios";

// Using Vietnam provinces API: https://provinces.open-api.vn/
const VIETNAM_PROVINCES_API = "https://provinces.open-api.vn/api";

export interface Province {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  phone_code: number;
}

export interface District {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  province_code: number;
}

export interface Ward {
  code: number;
  name: string;
  division_type: string;
  codename: string;
  district_code: number;
}

class AddressService {
  // Get all provinces
  async getProvinces(): Promise<Province[]> {
    const response = await axios.get<Province[]>(`${VIETNAM_PROVINCES_API}/p/`);
    return response.data;
  }

  // Get districts by province code
  async getDistrictsByProvince(provinceCode: number): Promise<District[]> {
    const response = await axios.get<{ districts: District[] }>(
      `${VIETNAM_PROVINCES_API}/p/${provinceCode}?depth=2`
    );
    return response.data.districts;
  }

  // Get wards by district code
  async getWardsByDistrict(districtCode: number): Promise<Ward[]> {
    const response = await axios.get<{ wards: Ward[] }>(
      `${VIETNAM_PROVINCES_API}/d/${districtCode}?depth=2`
    );
    return response.data.wards;
  }

  // Search provinces by name
  async searchProvinces(query: string): Promise<Province[]> {
    const response = await axios.get<Province[]>(
      `${VIETNAM_PROVINCES_API}/p/search/?q=${encodeURIComponent(query)}`
    );
    return response.data;
  }

  // Search districts by name
  async searchDistricts(query: string): Promise<District[]> {
    const response = await axios.get<District[]>(
      `${VIETNAM_PROVINCES_API}/d/search/?q=${encodeURIComponent(query)}`
    );
    return response.data;
  }

  // Search wards by name
  async searchWards(query: string): Promise<Ward[]> {
    const response = await axios.get<Ward[]>(
      `${VIETNAM_PROVINCES_API}/w/search/?q=${encodeURIComponent(query)}`
    );
    return response.data;
  }
}

export const addressService = new AddressService();
