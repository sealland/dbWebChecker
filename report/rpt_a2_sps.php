<?php
// เอาไว้ทำรายงาน A2 ของ SPS เพิ่มเติม จากกวง ตอนนี้ยังไม่ได้ใช้
/**
 * Creates an example PDF TEST document using TCPDF
 * @package com.tecnick.tcpdf
 * @abstract TCPDF - Example: HTML tables and table headers
 * @author Nicola Asuni
 * @since 2009-03-20
 */


require_once('tcpdf_include.php');
$ref = $_GET['ref'];
$user = get_current_user();
$domain = getenv('USERDOMAIN');

// create new PDF document
/**
 * Convert baht number to Thai text
 * @param double|int $number
 * @param bool $include_unit
 * @param bool $display_zero
 * @return string|null
 */


class MYPDF extends TCPDF
{

    public function Header()
    {
        //     $ref = $_GET['ref'];
        //$user = $_SERVER['REMOTE_USER'];
        //    $ref2 = $ref;
        //    $x = $this->GetX();
        //    $y = $this->GetY();
        //      $serverName = "192.168.117.102";
        //      $connectionInfo = array( "Database"=>"RMD2SCALE1", "UID"=>"sa", "PWD"=>"sipco77" , 'ReturnDatesAsStrings'=>true ,"CharacterSet" => "UTF-8");
        //      $connm = sqlsrv_connect( $serverName, $connectionInfo  );
        //      if( $connm === false ) {die( print_r( sqlsrv_errors(), true));}
        //            $sqlm = "SELECT *
        //            FROM dbo.[vw_A2_rpt] where LEFT(CONVERT(varchar, [rmd_date],23),7) = '$ref2'";

        //        $resultm = sqlsrv_query($connm, $sqlm);
        //        $rowm = sqlsrv_fetch_array($resultm, SQLSRV_FETCH_ASSOC);
        //        $x = $this->GetX();
        //        $y = $this->GetY();
        //        $myY = 10;
        //        $myX = 130;


        $this->SetFont('thsarabun', '', 10);
        $image_file = K_PATH_IMAGES . 'zubblogo.jpg';
        $this->Image($image_file, 10, 6, 28, '', 'JPG', '', 'T', false, 300, '', false, false, 0, false, false, false);

        $this->SetFont('thsarabun', 'B,U', 18);
        $this->SetY(8);
        $this->Cell(0, 10, 'รายงานผลิตภัณฑ์ที่ไม่เป็นไปตามข้อกำหนด', 0, false, 'C', 0, '', 0, false, 'M', 'M');

        //        $this->SetFont('thsarabun', 'B', 14);
        //        $this->SetY(16);
        //        $this->Cell(0, 10, 'ช่วง ________________________________ ', 0, false, 'L', 0, '', 0, false, 'M', 'M');


        //        $this->SetY(22);
        //        $this->Cell(0, 10, 'รูปแบบการใช้งาน : Copy,Print', 0, false, 'L', 0, '', 0, false, 'M', 'M');

        //        $this->SetY(16);
        //        $this->SetX(150);
        //        $this->Cell(0, 10, 'เครื่อง _____________________ ', 0, false, 'L', 0, '', 0, false, 'M', 'M');


        //        $this->SetY(22);
        //        $this->SetX(150);
        //        $this->Cell(0, 10,'สถานที่ติดตั้งเครื่อง ____________ ', 0, false, 'L', 0, '', 0, false, 'M', 'M');


    }
    public function Footer()
    {
    }
}

$pdf = new MYPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);



// set document information
$pdf->SetCreator(PDF_CREATOR);
$pdf->SetAuthor('IZE');
//$pdf->SetTitle($_GET['ref']);


// set default header data
$pdf->SetHeaderData(PDF_HEADER_LOGO, PDF_HEADER_LOGO_WIDTH, PDF_HEADER_TITLE . ' 048', PDF_HEADER_STRING);


// set header and footer fonts
$pdf->setHeaderFont(array(PDF_FONT_NAME_MAIN, '', PDF_FONT_SIZE_MAIN));
$pdf->setFooterFont(array(PDF_FONT_NAME_DATA, '', PDF_FONT_SIZE_DATA));

// set default monospaced font
$pdf->SetDefaultMonospacedFont(PDF_FONT_MONOSPACED);

// set margins
$pdf->SetMargins(10, 15, 10);
//$pdf->SetMargins(PDF_MARGIN_LEFT, PDF_MARGIN_TOP, PDF_MARGIN_RIGHT);
$pdf->SetHeaderMargin(10);
$pdf->SetFooterMargin(10);

// set auto page breaks
$pdf->SetAutoPageBreak(True, 12);


// set image scale factor
$pdf->setImageScale(PDF_IMAGE_SCALE_RATIO);

// set some language-dependent strings (optional)
if (@file_exists(dirname(__FILE__) . '/lang/eng.php')) {
    require_once(dirname(__FILE__) . '/lang/eng.php');
    $pdf->setLanguageArray($l);
}

//$ref = $_GET['ref'];


function fetch_data()
{
    $ref = $_GET['ref'];
    $ref2 = $ref;
    $serverName = "192.168.117.102";
    $connectionInfo = array("Database" => "RMD2SCALE1", "UID" => "sa", "PWD" => "sipco77", 'ReturnDatesAsStrings' => true, "CharacterSet" => "UTF-8");
    $conc = sqlsrv_connect($serverName, $connectionInfo);
    if ($conc === false) {
        die(print_r(sqlsrv_errors(), true));
    }
    $sql4 = "SELECT convert(nvarchar(10), rmd_date, 23) as date,[rmd_length]/1000 as length,*
            FROM dbo.vw_A2_rpt where  LEFT(CONVERT(varchar, [rmd_date],23),7) = '$ref2' ";
    $result4 = sqlsrv_query($conc, $sql4);
    //  $row4 = sqlsrv_fetch_array($result4, SQLSRV_FETCH_ASSOC);



    $output = '<style>
      tr { line-height: 19px;
        }
     </style>';
    $refr = $ref;
    $refs = $ref;
    $id = 0;
    while ($row4 = sqlsrv_fetch_array($result4, SQLSRV_FETCH_ASSOC)) {
        $id++;
        $output .= '
         <tr>
         <td align="Left"   width ="12%" >&nbsp;' . $row4['date'] . '</td>
         <td align="left"   width ="10%">&nbsp;' . $row4['hn'] . '&nbsp;</td>
         <td align="left"   width ="8%">&nbsp;' . $row4['rmd_qty2'] . '&nbsp;</td>
         <td align="left"   width ="18%">&nbsp;' . $row4['rmd_spec'] . ' ' . $row4['rmd_size'] . '&nbsp;</td>
         <td align="Right"  width ="8%">' . $row4['length'] . '&nbsp;</td>
         <td align="Center"   width ="8%">' . $row4['rmd_qa_grade'] . '</td>
         <td align="Right"  width ="10%">' . number_format($row4['rmd_qty3']) . '&nbsp;</td>
         <td align="right" width ="8%" >' . number_format($row4['rmd_weight']) . '&nbsp;</td>
         <td align="left"   width ="18%">&nbsp;' . $row4['rmd_remark'] . '</td>
         </tr>';
        //$trh = number_format($rows['TRH_N_QTY']) ;
    }

    return $output;
}
function fetch_sum($ref)
{
    $ref = $_GET['ref'];
    $ref2 = $ref;
    $serverName = "192.168.117.102";
    $connectionInfo = array("Database" => "RMD2SCALE1", "UID" => "sa", "PWD" => "sipco77", 'ReturnDatesAsStrings' => true, "CharacterSet" => "UTF-8");
    $conn = sqlsrv_connect($serverName, $connectionInfo);
    if ($conn === false) {
        die(print_r(sqlsrv_errors(), true));
    }
    $sql5 = "SELECT  sum(rmd_qty3) as sQty3,sum(rmd_weight) as sweight FROM dbo.vw_A2_rpt where  LEFT(CONVERT(varchar, [rmd_date],23),7) = '$ref2'";
    $result5 = sqlsrv_query($conn, $sql5);
    $n = 0;
    $l = 0;
    $s = 0;


    while ($rows5 = sqlsrv_fetch_array($result5, SQLSRV_FETCH_ASSOC)) {
        $output = '';
        $output .= '

      <table border = "0.1" bgcolor="#AAAAAA">
      <style>
      td { line-height: 19px;
        }
     </style>

      <tr>
         <td align="right"   width ="64%" >รวม&nbsp;</td>
         <td class = "x" align="Right"  width ="10%">&nbsp;' . number_format($rows5['sQty3']) . '&nbsp;</td>
         <td align="Right"   width ="8%">' . number_format($rows5['sweight']) . '&nbsp;</td>
         <td align="left"   width ="18%"></td>
      </tr>

     </table>
      ';
        return $output;
    }
}

function fetch_size($ref)
{
    $ref = $_GET['ref'];
    $ref2 = $ref;
    $serverName = "192.168.117.102";
    $connectionInfo = array("Database" => "RMD2SCALE1", "UID" => "sa", "PWD" => "sipco77", 'ReturnDatesAsStrings' => true, "CharacterSet" => "UTF-8");
    $conn = sqlsrv_connect($serverName, $connectionInfo);
    if ($conn === false) {
        die(print_r(sqlsrv_errors(), true));
    }
    $sql5 = "SELECT  [rmd_size]
          FROM [RMD2SCALE1].[dbo].[vw_A2_rpt]
          where  LEFT(CONVERT(varchar, [rmd_date],23),7) = '$ref2'
          group by rmd_size";
    $result5 = sqlsrv_query($conn, $sql5);
    $output = '';
    $refa = $ref;
    while ($row5 = sqlsrv_fetch_array($result5, SQLSRV_FETCH_ASSOC)) {
        $output .= fetch_overall($row5['rmd_size'], $refa) . fetch_summary($row5['rmd_size'], $refa);
    }
    return $output;
}

function fetch_overall($size, $ref2)
{
    $ref = $_GET['ref'];
    $ref2 = $ref;
    $serverName = "192.168.117.102";
    $connectionInfo = array("Database" => "RMD2SCALE1", "UID" => "sa", "PWD" => "sipco77", 'ReturnDatesAsStrings' => true, "CharacterSet" => "UTF-8");
    $conn = sqlsrv_connect($serverName, $connectionInfo);
    if ($conn === false) {
        die(print_r(sqlsrv_errors(), true));
    }
    $sql5 = "SELECT  [rmd_size],[rmd_qa_grade],[rmd_remark],rmd_spec,sum([rmd_qty3]) as sumqty3,sum([rmd_weight]) as sweight
          FROM [RMD2SCALE1].[dbo].[vw_A2_rpt]
          where  LEFT(CONVERT(varchar, [rmd_date],23),7) = '$ref2' and rmd_size = '$size'
          group by [rmd_size],[rmd_qa_grade],[rmd_remark],rmd_spec";
    $result5 = sqlsrv_query($conn, $sql5);
    $output = '';
    $refa = $ref;
    while ($row5 = sqlsrv_fetch_array($result5, SQLSRV_FETCH_ASSOC)) {
        $output .= '

      <tr>
         <td align="Left"   width ="22%" >&nbsp;' . $row5['rmd_spec'] . ' ' . $row5['rmd_size'] . '</td>
         <td align="left"   width ="8%">&nbsp;' . $row5['rmd_qa_grade'] . '&nbsp;</td>
         <td align="left"   width ="23%">&nbsp;' . $row5['rmd_remark'] . '&nbsp;</td>
         <td align="Right"  width ="13%">' . number_format($row5['sumqty3']) . '&nbsp;</td>
         <td align="Right"   width ="15%">' . number_format($row5['sweight']) . '&nbsp;</td>
      </tr> ';
    }
    return $output;
}

function fetch_summary($size, $ref2)
{
    $ref = $_GET['ref'];
    $ref2 = $ref;
    $serverName = "192.168.117.102";
    $connectionInfo = array("Database" => "RMD2SCALE1", "UID" => "sa", "PWD" => "sipco77", 'ReturnDatesAsStrings' => true, "CharacterSet" => "UTF-8");
    $conn = sqlsrv_connect($serverName, $connectionInfo);
    if ($conn === false) {
        die(print_r(sqlsrv_errors(), true));
    }
    $sql5 = "SELECT  sum(rmd_qty3) as sQty3,sum(rmd_weight) as sweight FROM dbo.vw_A2_rpt where  LEFT(CONVERT(varchar, [rmd_date],23),7) = '$ref2' and rmd_size = '$size'";
    $result5 = sqlsrv_query($conn, $sql5);
    $rs = "";


    while ($rows5 = sqlsrv_fetch_array($result5, SQLSRV_FETCH_ASSOC)) {
        $rs .= '

      <table border = "0.1" bgcolor="#AAAAAA">
      <style>
      td { line-height: 19px;
        }
     </style>

      <tr>
         <td align="right"   width ="53%" ><b>รวม&nbsp;</b></td>
         <td class = "x" align="Right"  width ="13%"><b>' . number_format($rows5['sQty3']) . '&nbsp;</b></td>
         <td align="Right"   width ="15%"><b>' . number_format($rows5['sweight']) . '&nbsp;</b></td>
      </tr>

     </table>
      ';
        return $rs;
    }
}

$pdf->AddPage('P', 'A4');

$pdf->SetFont('thsarabun', 'B', 14);
$tbh = '';

$pdf->SetFont('cordiaupc', '', 14);
$pdf->SetAbsXY(10, 16);
$tbl = '';
$tbl .= '


<table border="0.8">
<thead>
<tr bgcolor="#AAAAAA">
<th align="Center" width ="12%" rowspan><b>วันที่ผลิต</b></th>
<th align="Center" width ="10%" rowspan ><b>Heat No.</b></th>
<th align="Center" width ="8%" rowspan ><b>มัดที่</b></th>
<th align="Center" width ="18%" rowspan ><b>ชนิดผลิตภัณฑ์</b></th>
<th align="Center" width ="8%" rowspan><b>ความยาว<br>(เมตร)</b></th>
<th align="Center" width ="8%" rowspan ><b>เกรด</b></th>
<th align="Center" width ="10%" rowspan ><b>จำนวน<br>(เส้น)</b></th>
<th align="Center" width ="8%" rowspan ><b>น้ำหนัก</b></th>
<th align="Center" width ="18%" rowspan ><b>หมายเหตุ</b></th>
</tr></thead>
';



$tbl .= fetch_data();
$tbl .= '</table>';
$pdf->writeHTML($tbl, true, false, false, false, '');

$y = $pdf->GetY();
$pdf->SetFont('cordiaupc', '', 14);
$pdf->SetAbsXY(10, $y - 6); //รวมมูลค่าสินค้าทั้งหมด
$tamount = fetch_sum($ref);
$pdf->writeHTML($tamount, true, false, false, false, '');

$month = substr($ref, 5, 2);
$name = "";
switch ($month) {
    case "01":
        $name = "มกราคม";
        break;
    case "02":
        $name = "กุมภาพันธ์";
        break;
    case "03":
        $name = "มีนาคม";
        break;
    case "04":
        $name = "เมษายน";
        break;
    case "05":
        $name = "พฤษภาคม";
        break;
    case "06":
        $name = "มิถุนายน";
        break;
    case "07":
        $name = "กรกฎาคม";
        break;
    case "08":
        $name = "สิงหาคม";
        break;
    case "09":
        $name = "กันยายน";
        break;
    case "10":
        $name = "ตุลาคม";
        break;
    case "11":
        $name = "พฤศจิกายน";
        break;
    case "12":
        $name = "ธันวาคม";
        break;
}

$y = $pdf->GetY();
$pdf->SetFont('thsarabun', 'B,U', 18);
$pdf->SetY($y);
$pdf->Cell(0, 10, 'สรุปรายงานผลิตภัณฑ์ที่ไม่เป็นไปตามข้อกำหนดประจำเดือน ' . $name, 0, false, 'C', 0, '', 0, false, 'M', 'M');

$y = $pdf->GetY();
$pdf->SetFont('cordiaupc', '', 14);
$pdf->SetAbsXY(50, $y + 5); //รวมมูลค่าสินค้าทั้งหมด
$ta = '';
$ta .= '


<table border="0.8">

<tr bgcolor="#AAAAAA">
<thead>
<th align="Center" width ="22%" rowspan><b>ชนิดผลิตภัณฑ์</b></th>
<th align="Center" width ="8%" rowspan ><b>เกรด</b></th>
<th align="Center" width ="23%" rowspan ><b>ปัญหา</b></th>
<th align="Center" width ="13%" rowspan ><b>จำนวนเส้น</b></th>
<th align="Center" width ="15%" rowspan ><b>น้ำหนัก(Kg.)</b></th>
</thead>
</tr>

';



$ta .= fetch_size($ref);
$ta .= '</table>';
$pdf->writeHTML($ta, true, false, false, false, '');

$pdf->SetFont('thsarabun', 'b', 12);
$pdf->SetAbsXY(10, 228.5);
$pdf->Output('zubb.pdf', 'I');

//============================================================+
// END OF FILE
//============================================================+
