
import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchIcon } from "lucide-react";

interface DeviceFilterProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  categoryFilter: string;
  setCategoryFilter: (category: string) => void;
}

const DeviceFilter: React.FC<DeviceFilterProps> = ({
  searchTerm,
  setSearchTerm,
  categoryFilter,
  setCategoryFilter,
}) => {
  return (
    <div className="flex items-center justify-between space-x-2 pb-4">
      <div className="flex items-center space-x-2">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search devices..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <Select
        value={categoryFilter}
        onValueChange={(value) => setCategoryFilter(value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="Switch">Switches</SelectItem>
          <SelectItem value="AP">Access Points</SelectItem>
          <SelectItem value="Controller">Controllers</SelectItem>
          <SelectItem value="Router">Routers</SelectItem>
          <SelectItem value="Other">Other</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default DeviceFilter;
