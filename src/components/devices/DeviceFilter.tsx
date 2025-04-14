
import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DeviceFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string) => void;
}

const DeviceFilter = ({
  selectedCategory,
  onCategoryChange,
}: DeviceFilterProps) => {
  return (
    <Select
      value={selectedCategory || "all"}
      onValueChange={(value) => onCategoryChange(value)}
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
  );
};

export default DeviceFilter;
