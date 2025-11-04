import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingUp, Home, RefreshCw } from "lucide-react";

export default function InlineCalculator() {
  const [buyerInputs, setBuyerInputs] = useState({
    price: "500000",
    downPercent: "20",
    rate: "6.8",
    term: "30",
    insurance: "150",
    taxes: "400",
    hoa: "0",
    income: "8000"
  });

  const [investorInputs, setInvestorInputs] = useState({
    arv: "350000",
    purchase: "200000",
    rehab: "50000",
    holding: "5000",
    selling: "10",
    downPercent: "25"
  });

  const [rentalInputs, setRentalInputs] = useState({
    price: "300000",
    rent: "2500",
    downPercent: "25",
    rate: "7.2",
    taxes: "300",
    insurance: "150",
    hoa: "0",
    maintenance: "200",
    vacancy: "8",
    management: "10"
  });

  const calculateBuyer = () => {
    const price = parseFloat(buyerInputs.price);
    const down = (parseFloat(buyerInputs.downPercent) / 100) * price;
    const loan = price - down;
    const monthlyRate = parseFloat(buyerInputs.rate) / 100 / 12;
    const numPayments = parseInt(buyerInputs.term) * 12;
    const payment = (loan * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                    (Math.pow(1 + monthlyRate, numPayments) - 1);
    const pmi = parseFloat(buyerInputs.downPercent) < 20 ? loan * 0.005 / 12 : 0;
    const total = payment + pmi + parseFloat(buyerInputs.insurance) + 
                  parseFloat(buyerInputs.taxes) + parseFloat(buyerInputs.hoa);
    const dti = (total / parseFloat(buyerInputs.income)) * 100;

    return { payment, pmi, total, dti, down };
  };

  const calculateInvestor = () => {
    const arv = parseFloat(investorInputs.arv);
    const purchase = parseFloat(investorInputs.purchase);
    const rehab = parseFloat(investorInputs.rehab);
    const holding = parseFloat(investorInputs.holding);
    const sellingCost = (parseFloat(investorInputs.selling) / 100) * arv;
    const totalInvested = purchase + rehab + holding + sellingCost;
    const profit = arv - totalInvested;
    const roi = (profit / totalInvested) * 100;
    const maxOffer = arv * 0.7 - rehab;

    return { arv, maxOffer, totalInvested, profit, roi };
  };

  const calculateRental = () => {
    const price = parseFloat(rentalInputs.price);
    const rent = parseFloat(rentalInputs.rent);
    const down = (parseFloat(rentalInputs.downPercent) / 100) * price;
    const loan = price - down;
    const monthlyRate = parseFloat(rentalInputs.rate) / 100 / 12;
    const numPayments = 30 * 12;
    const mortgage = (loan * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                     (Math.pow(1 + monthlyRate, numPayments) - 1);
    
    const expenses = mortgage + parseFloat(rentalInputs.taxes) + 
                     parseFloat(rentalInputs.insurance) + parseFloat(rentalInputs.hoa) + 
                     parseFloat(rentalInputs.maintenance);
    const vacancyLoss = rent * (parseFloat(rentalInputs.vacancy) / 100);
    const managementFee = rent * (parseFloat(rentalInputs.management) / 100);
    const netRent = rent - vacancyLoss - managementFee;
    const cashFlow = netRent - expenses;
    const annualCashFlow = cashFlow * 12;
    const capRate = (annualCashFlow / price) * 100;
    const cocReturn = (annualCashFlow / down) * 100;
    const onePercent = (rent / price) * 100;

    return { expenses, cashFlow, annualCashFlow, capRate, cocReturn, onePercent };
  };

  const buyerResults = calculateBuyer();
  const investorResults = calculateInvestor();
  const rentalResults = calculateRental();

  return (
    <Card className="my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Real Estate Calculators
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="buyer" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="buyer">
              <Home className="h-4 w-4 mr-1" />
              Buyer
            </TabsTrigger>
            <TabsTrigger value="investor">
              <TrendingUp className="h-4 w-4 mr-1" />
              Investor
            </TabsTrigger>
            <TabsTrigger value="rental">
              <RefreshCw className="h-4 w-4 mr-1" />
              Rental
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buyer">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Property Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Purchase Price</Label>
                    <Input type="number" value={buyerInputs.price} 
                           onChange={(e) => setBuyerInputs({...buyerInputs, price: e.target.value})} />
                  </div>
                  <div>
                    <Label>Down Payment %</Label>
                    <Input type="number" value={buyerInputs.downPercent}
                           onChange={(e) => setBuyerInputs({...buyerInputs, downPercent: e.target.value})} />
                  </div>
                  <div>
                    <Label>Interest Rate %</Label>
                    <Input type="number" step="0.1" value={buyerInputs.rate}
                           onChange={(e) => setBuyerInputs({...buyerInputs, rate: e.target.value})} />
                  </div>
                  <div>
                    <Label>Loan Term (Years)</Label>
                    <Input type="number" value={buyerInputs.term}
                           onChange={(e) => setBuyerInputs({...buyerInputs, term: e.target.value})} />
                  </div>
                  <div>
                    <Label>Property Tax (Monthly)</Label>
                    <Input type="number" value={buyerInputs.taxes}
                           onChange={(e) => setBuyerInputs({...buyerInputs, taxes: e.target.value})} />
                  </div>
                  <div>
                    <Label>Insurance (Monthly)</Label>
                    <Input type="number" value={buyerInputs.insurance}
                           onChange={(e) => setBuyerInputs({...buyerInputs, insurance: e.target.value})} />
                  </div>
                  <div>
                    <Label>HOA (Monthly)</Label>
                    <Input type="number" value={buyerInputs.hoa}
                           onChange={(e) => setBuyerInputs({...buyerInputs, hoa: e.target.value})} />
                  </div>
                  <div>
                    <Label>Monthly Income</Label>
                    <Input type="number" value={buyerInputs.income}
                           onChange={(e) => setBuyerInputs({...buyerInputs, income: e.target.value})} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Down Payment:</span>
                    <strong>${buyerResults.down.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly P&I:</span>
                    <strong>${buyerResults.payment.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  {buyerResults.pmi > 0 && (
                    <div className="flex justify-between">
                      <span>PMI:</span>
                      <strong>${buyerResults.pmi.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Total Monthly:</span>
                    <strong>${buyerResults.total.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>DTI Ratio:</span>
                    <strong className={buyerResults.dti > 43 ? "text-destructive" : ""}>
                      {buyerResults.dti.toFixed(1)}%
                    </strong>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="investor">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Deal Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>After Repair Value (ARV)</Label>
                    <Input type="number" value={investorInputs.arv}
                           onChange={(e) => setInvestorInputs({...investorInputs, arv: e.target.value})} />
                  </div>
                  <div>
                    <Label>Purchase Price</Label>
                    <Input type="number" value={investorInputs.purchase}
                           onChange={(e) => setInvestorInputs({...investorInputs, purchase: e.target.value})} />
                  </div>
                  <div>
                    <Label>Rehab Budget</Label>
                    <Input type="number" value={investorInputs.rehab}
                           onChange={(e) => setInvestorInputs({...investorInputs, rehab: e.target.value})} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Max Offer (70% Rule):</span>
                    <strong>${investorResults.maxOffer.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Investment:</span>
                    <strong>${investorResults.totalInvested.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Potential Profit:</span>
                    <strong className={investorResults.profit < 0 ? "text-destructive" : "text-green-600"}>
                      ${investorResults.profit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>ROI:</span>
                    <strong className={investorResults.roi < 15 ? "text-yellow-600" : "text-green-600"}>
                      {investorResults.roi.toFixed(1)}%
                    </strong>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rental">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Property Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label>Purchase Price</Label>
                    <Input type="number" value={rentalInputs.price}
                           onChange={(e) => setRentalInputs({...rentalInputs, price: e.target.value})} />
                  </div>
                  <div>
                    <Label>Monthly Rent</Label>
                    <Input type="number" value={rentalInputs.rent}
                           onChange={(e) => setRentalInputs({...rentalInputs, rent: e.target.value})} />
                  </div>
                  <div>
                    <Label>Down Payment %</Label>
                    <Input type="number" value={rentalInputs.downPercent}
                           onChange={(e) => setRentalInputs({...rentalInputs, downPercent: e.target.value})} />
                  </div>
                  <div>
                    <Label>Interest Rate %</Label>
                    <Input type="number" step="0.1" value={rentalInputs.rate}
                           onChange={(e) => setRentalInputs({...rentalInputs, rate: e.target.value})} />
                  </div>
                  <div>
                    <Label>Property Tax (Monthly)</Label>
                    <Input type="number" value={rentalInputs.taxes}
                           onChange={(e) => setRentalInputs({...rentalInputs, taxes: e.target.value})} />
                  </div>
                  <div>
                    <Label>Insurance (Monthly)</Label>
                    <Input type="number" value={rentalInputs.insurance}
                           onChange={(e) => setRentalInputs({...rentalInputs, insurance: e.target.value})} />
                  </div>
                  <div>
                    <Label>HOA (Monthly)</Label>
                    <Input type="number" value={rentalInputs.hoa}
                           onChange={(e) => setRentalInputs({...rentalInputs, hoa: e.target.value})} />
                  </div>
                  <div>
                    <Label>Maintenance (Monthly)</Label>
                    <Input type="number" value={rentalInputs.maintenance}
                           onChange={(e) => setRentalInputs({...rentalInputs, maintenance: e.target.value})} />
                  </div>
                  <div>
                    <Label>Vacancy Rate %</Label>
                    <Input type="number" value={rentalInputs.vacancy}
                           onChange={(e) => setRentalInputs({...rentalInputs, vacancy: e.target.value})} />
                  </div>
                  <div>
                    <Label>Management Fee %</Label>
                    <Input type="number" value={rentalInputs.management}
                           onChange={(e) => setRentalInputs({...rentalInputs, management: e.target.value})} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Monthly Expenses:</span>
                    <strong>${rentalResults.expenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Flow:</span>
                    <strong className={rentalResults.cashFlow < 0 ? "text-destructive" : "text-green-600"}>
                      ${rentalResults.cashFlow.toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cap Rate:</span>
                    <strong>{rentalResults.capRate.toFixed(2)}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash-on-Cash:</span>
                    <strong>{rentalResults.cocReturn.toFixed(2)}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>1% Rule:</span>
                    <strong className={rentalResults.onePercent < 1 ? "text-yellow-600" : "text-green-600"}>
                      {rentalResults.onePercent.toFixed(2)}%
                    </strong>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
